import crypto from 'node:crypto';

import { getEnv } from '$lib/server/env';
import { getLogger } from '$lib/server/logger';
import { beginCriticalWork, endCriticalWork, isShuttingDown } from '$lib/server/shutdown';
import {
	defaultFetchIcs,
	parseIcsEvents,
	redactFeedError,
	type FetchIcs,
	type ParsedIcsEvent
} from '$lib/server/sync/ics';
import {
	getCalendarSubscriptionById,
	getCalendarSubscriptionForUser,
	isCalendarSyncRunning,
	listCalendarSubscriptionsForUser,
	listEnabledCalendarSubscriptionsForUser,
	releaseCalendarSync,
	tryAcquireCalendarSync,
	updateCalendarConditional,
	type CalendarSyncRelease,
	type DbCalendarSubscription
} from '$lib/server/repositories/calendarSubscriptionsRepository';
import {
	countConflictsForUser,
	createSyncedWorkout,
	deleteSyncedWorkout,
	listSyncedWorkoutsForSubscription,
	markSyncedWorkoutCancelled,
	markSyncedWorkoutConflict,
	markSyncedWorkoutUserModified,
	updateSyncedWorkout,
	type LinkWithWorkout,
	type UpstreamSignals
} from '$lib/server/repositories/calendarSyncedWorkoutsRepository';
import { createImportBatch, updateImportBatchProgress } from '$lib/server/repositories/importBatchesRepository';
import { hashWorkoutFields, mapIcsEventToWorkout, workoutRowToMapped } from '$lib/server/services/sync/calendarMapping';
import { reconcileEvent } from '$lib/server/services/sync/calendarReconcile';

export const CALENDAR_SYNC_SOURCE = 'calendar-ics';
const DAY_MS = 24 * 60 * 60 * 1000;

export type CalendarSyncOutcome =
	| 'ok'
	| 'not_modified'
	| 'unreachable'
	| 'parse_error'
	| 'rate_limited'
	| 'error'
	| 'skipped'
	| 'disabled';

export type CalendarReconcileCounts = {
	created: number;
	updated: number;
	unchanged: number;
	preserved: number;
	conflicts: number;
	removed: number;
	cancelled: number;
	failed: number;
};

export type CalendarSyncResult = CalendarReconcileCounts & {
	outcome: CalendarSyncOutcome;
	error?: string;
};

export type CalendarSyncOptions = {
	/** Injectable fetcher for tests. Defaults to the real conditional fetch. */
	fetchIcs?: FetchIcs;
	/** Manual "Sync now": bypass the throttle (still honors the lock). */
	ignoreThrottle?: boolean;
	/** Injectable clock for deterministic tests. */
	now?: number;
};

function zeroCounts(): CalendarReconcileCounts {
	return { created: 0, updated: 0, unchanged: 0, preserved: 0, conflicts: 0, removed: 0, cancelled: 0, failed: 0 };
}

function classifyFetchError(message: string): CalendarSyncOutcome {
	return /\b429\b|too many requests|rate.?limit/i.test(message) ? 'rate_limited' : 'unreachable';
}

/** Sync one subscription: conditional fetch → parse/expand → reconcile. Mirrors
 * syncForUser's try-acquire / beginCriticalWork / finally-release skeleton. */
export async function syncCalendarSubscription(
	subscriptionId: string,
	opts: CalendarSyncOptions = {}
): Promise<CalendarSyncResult> {
	const counts = zeroCounts();

	if (isShuttingDown()) return { outcome: 'skipped', ...counts };

	const sub = getCalendarSubscriptionById(subscriptionId);
	if (!sub) return { outcome: 'skipped', ...counts };
	if (!sub.enabled) return { outcome: 'disabled', ...counts };

	if (!tryAcquireCalendarSync(subscriptionId, { ignoreThrottle: opts.ignoreThrottle, now: opts.now })) {
		return { outcome: 'skipped', ...counts };
	}

	beginCriticalWork();
	let release: CalendarSyncRelease = { ok: false, status: 'error', error: null };
	const fetchIcs = opts.fetchIcs ?? defaultFetchIcs;
	const env = getEnv();
	const now = opts.now ?? Date.now();

	try {
		let fetchResult;
		try {
			fetchResult = await fetchIcs(sub.url, { etag: sub.etag, lastModified: sub.lastModified });
		} catch (err) {
			const message = redactFeedError(err, sub.url);
			const outcome = classifyFetchError(message);
			getLogger().warn({ subscriptionId, outcome }, 'calendar sync: fetch failed');
			release = { ok: false, status: outcome, error: message };
			return { outcome, ...counts, error: message };
		}

		if (fetchResult.status === 'not_modified') {
			release = { ok: true, status: 'not_modified' };
			return { outcome: 'not_modified', ...counts };
		}

		const windowStartMs = now - env.CALENDAR_SYNC_PAST_GRACE_DAYS * DAY_MS;
		const windowEndMs = now + env.CALENDAR_SYNC_HORIZON_DAYS * DAY_MS;

		let parsed;
		try {
			parsed = parseIcsEvents(fetchResult.raw, {
				windowStartMs,
				windowEndMs,
				maxOccurrences: env.CALENDAR_MAX_OCCURRENCES
			});
		} catch (err) {
			const message = redactFeedError(err, sub.url);
			getLogger().warn({ subscriptionId }, 'calendar sync: parse failed');
			release = { ok: false, status: 'parse_error', error: message };
			return { outcome: 'parse_error', ...counts, error: message };
		}
		counts.failed += parsed.failed;

		await reconcileSubscription(sub, parsed.events, counts, windowStartMs, windowEndMs);

		await updateCalendarConditional({
			id: subscriptionId,
			etag: fetchResult.etag,
			lastModified: fetchResult.lastModified,
			lastEventCount: parsed.events.length
		});

		await writeRunLogIfChanged(sub, parsed.events.length, counts);

		getLogger().info({ subscriptionId, ...counts }, 'calendar sync: ok');
		release = { ok: true, status: 'ok' };
		return { outcome: 'ok', ...counts };
	} catch (err) {
		const message = redactFeedError(err, sub.url);
		getLogger().error({ subscriptionId }, 'calendar sync: error');
		release = { ok: false, status: 'error', error: message };
		return { outcome: 'error', ...counts, error: message };
	} finally {
		releaseCalendarSync(subscriptionId, release, now);
		endCriticalWork();
	}
}

function dateInWindow(scheduledDate: string, windowStartMs: number, windowEndMs: number): boolean {
	// Compare at local noon so a few hours of time-of-day never flip the verdict.
	const dayMs = new Date(`${scheduledDate}T12:00:00`).getTime();
	if (!Number.isFinite(dayMs)) return false;
	return dayMs >= windowStartMs && dayMs <= windowEndMs;
}

async function reconcileSubscription(
	sub: DbCalendarSubscription,
	events: ParsedIcsEvent[],
	counts: CalendarReconcileCounts,
	windowStartMs: number,
	windowEndMs: number
): Promise<void> {
	// Cancelled events count as "absent from the feed" — drop them from upstream.
	const upstream = new Map<string, ParsedIcsEvent>();
	for (const ev of events) {
		if (!ev.uid || ev.cancelled) continue;
		upstream.set(`${ev.uid}::${ev.recurrenceId}`, ev);
	}

	const existing = await listSyncedWorkoutsForSubscription(sub.id);
	const existingByKey = new Map<string, LinkWithWorkout>();
	for (const e of existing) {
		existingByKey.set(`${e.link.icalUid}::${e.link.recurrenceId}`, e);
	}

	for (const [key, ev] of upstream) {
		await reconcileUpstream(sub, ev, existingByKey.get(key) ?? null, counts);
	}

	for (const [key, entry] of existingByKey) {
		if (upstream.has(key)) continue;
		await reconcileAbsent(sub, entry, counts, windowStartMs, windowEndMs);
	}
}

async function reconcileUpstream(
	sub: DbCalendarSubscription,
	ev: ParsedIcsEvent,
	entry: LinkWithWorkout | null,
	counts: CalendarReconcileCounts
): Promise<void> {
	const mapped = mapIcsEventToWorkout(ev);
	const upstreamHash = hashWorkoutFields(mapped);
	const link = entry?.link ?? null;
	const hasWorkout = !!(link && link.plannedWorkoutId && entry?.workout);
	const currentHash = hasWorkout ? hashWorkoutFields(workoutRowToMapped(entry!.workout!)) : null;
	const signals: UpstreamSignals = { sequence: ev.sequence, lastModified: ev.lastModified };

	const action = reconcileEvent({
		link: link
			? { state: link.state, syncedHash: link.syncedHash, conflictHash: link.conflictHash, hasPlannedWorkout: hasWorkout }
			: null,
		upstreamPresent: true,
		upstreamHash,
		currentHash
	});

	switch (action) {
		case 'create':
			await createSyncedWorkout({
				plannedWorkoutId: crypto.randomUUID(),
				linkId: crypto.randomUUID(),
				subscriptionId: sub.id,
				userId: sub.userId,
				icalUid: ev.uid,
				recurrenceId: ev.recurrenceId,
				fields: mapped,
				syncedHash: upstreamHash,
				signals
			});
			counts.created++;
			break;
		case 'update':
			await updateSyncedWorkout({
				linkId: link!.id,
				plannedWorkoutId: link!.plannedWorkoutId!,
				userId: sub.userId,
				fields: mapped,
				syncedHash: upstreamHash,
				signals
			});
			counts.updated++;
			break;
		case 'preserve':
			await markSyncedWorkoutUserModified(link!.id);
			counts.preserved++;
			break;
		case 'conflict':
		case 'conflict-refresh':
			await markSyncedWorkoutConflict({
				linkId: link!.id,
				conflictJson: JSON.stringify(mapped),
				conflictHash: upstreamHash,
				signals
			});
			counts.conflicts++;
			break;
		case 'noop':
			counts.unchanged++;
			break;
		case 'skip':
			break;
	}
}

async function reconcileAbsent(
	sub: DbCalendarSubscription,
	entry: LinkWithWorkout,
	counts: CalendarReconcileCounts,
	windowStartMs: number,
	windowEndMs: number
): Promise<void> {
	const { link, workout } = entry;
	// Tombstone (user-deleted) → leave forever. Also skip anything without a live
	// workout row.
	if (!link.plannedWorkoutId || !workout) return;
	// Only remove/flag events that fall in the window the parser actually covers —
	// otherwise a past workout aging out of the horizon would be wrongly deleted.
	if (!dateInWindow(workout.scheduledDate, windowStartMs, windowEndMs)) return;

	const currentHash = hashWorkoutFields(workoutRowToMapped(workout));
	const action = reconcileEvent({
		link: { state: link.state, syncedHash: link.syncedHash, conflictHash: link.conflictHash, hasPlannedWorkout: true },
		upstreamPresent: false,
		upstreamHash: null,
		currentHash
	});

	switch (action) {
		case 'delete':
			await deleteSyncedWorkout({ linkId: link.id, plannedWorkoutId: link.plannedWorkoutId, userId: sub.userId });
			counts.removed++;
			break;
		case 'flag-cancelled':
			await markSyncedWorkoutCancelled(link.id);
			counts.cancelled++;
			break;
		default:
			break;
	}
}

async function writeRunLogIfChanged(
	sub: DbCalendarSubscription,
	totalEvents: number,
	counts: CalendarReconcileCounts
): Promise<void> {
	const changed = counts.created + counts.updated + counts.removed + counts.cancelled + counts.conflicts + counts.failed;
	if (changed === 0) return; // keep /imports free of no-op poll noise

	const batchId = crypto.randomUUID();
	const now = new Date();
	await createImportBatch({
		id: batchId,
		userId: sub.userId,
		source: CALENDAR_SYNC_SOURCE,
		originalName: `${sub.label} (calendar)`,
		status: 'processing',
		startedAt: now
	});
	await updateImportBatchProgress({
		id: batchId,
		userId: sub.userId,
		status: 'completed',
		totalFiles: totalEvents,
		processedFiles: totalEvents,
		importedCount: counts.created + counts.updated,
		duplicateCount: counts.unchanged + counts.preserved,
		failedCount: counts.failed,
		completedAt: new Date()
	});
}

/** Fire-and-forget poll of every enabled feed for a user, each throttled by its
 * own subscription row. Never throws — safe to `void` from a layout load. */
export async function maybeTriggerCalendarSync(userId: string, opts: CalendarSyncOptions = {}): Promise<void> {
	try {
		if (isShuttingDown()) return;
		const subs = await listEnabledCalendarSubscriptionsForUser(userId);
		for (const sub of subs) {
			void syncCalendarSubscription(sub.id, opts).catch(() => {});
		}
	} catch {
		// Best-effort; never disrupt a page load.
	}
}

/** Manual "Sync now" for one subscription. Verifies ownership, bypasses the
 * throttle. Returns null if the subscription isn't the user's. */
export async function syncCalendarSubscriptionNow(
	subscriptionId: string,
	userId: string,
	opts: CalendarSyncOptions = {}
): Promise<CalendarSyncResult | null> {
	const sub = await getCalendarSubscriptionForUser(subscriptionId, userId);
	if (!sub) return null;
	return syncCalendarSubscription(subscriptionId, { ...opts, ignoreThrottle: true });
}

export type CalendarSubscriptionView = {
	id: string;
	label: string;
	host: string;
	enabled: boolean;
	state: 'syncing' | 'ok' | 'failing' | 'rate_limited' | 'never' | 'disabled';
	lastPolledAt: number | null;
	lastError: string | null;
	lastEventCount: number | null;
	retryAt: number | null;
};

function hostOf(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return 'calendar feed';
	}
}

function viewState(sub: DbCalendarSubscription, now: number): CalendarSubscriptionView['state'] {
	if (!sub.enabled) return 'disabled';
	if (isCalendarSyncRunning(sub, now)) return 'syncing';
	const cooling = sub.cooldownUntil ? sub.cooldownUntil.getTime() > now : false;
	if (sub.lastStatus === 'rate_limited' && cooling) return 'rate_limited';
	if (sub.status === 'failed') return 'failing';
	if (sub.lastPolledAt) return 'ok';
	return 'never';
}

/** Page-safe summary for the settings UI — never throws, never exposes the URL
 * (only its host). */
export async function getCalendarSyncSummaryForUser(
	userId: string
): Promise<{ subscriptions: CalendarSubscriptionView[]; conflicts: number }> {
	try {
		const now = Date.now();
		const subs = await listCalendarSubscriptionsForUser(userId);
		const subscriptions = subs.map((s) => ({
			id: s.id,
			label: s.label,
			host: hostOf(s.url),
			enabled: s.enabled,
			state: viewState(s, now),
			lastPolledAt: s.lastPolledAt ? s.lastPolledAt.getTime() : null,
			lastError: s.lastError,
			lastEventCount: s.lastEventCount,
			retryAt: s.cooldownUntil && s.cooldownUntil.getTime() > now ? s.cooldownUntil.getTime() : null
		}));
		const conflicts = await countConflictsForUser(userId);
		return { subscriptions, conflicts };
	} catch {
		return { subscriptions: [], conflicts: 0 };
	}
}
