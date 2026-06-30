import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '$lib/server/db/client';
import { getEnv } from '$lib/server/env';
import { calendarSubscriptions } from '$lib/server/db/schema';
import {
	computeBackoffMs,
	RATE_LIMITED_STATUS,
	SYNC_LOCK_TTL_MS
} from '$lib/server/repositories/syncJobsRepository';

export type DbCalendarSubscription = typeof calendarSubscriptions.$inferSelect;

// Per-process id stamped on the lock for debugging which instance holds it.
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

export async function createCalendarSubscription(input: {
	id: string;
	userId: string;
	url: string;
	label: string;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.insert(calendarSubscriptions)
		.values({
			id: input.id,
			userId: input.userId,
			url: input.url,
			label: input.label,
			createdAt: now,
			updatedAt: now
		})
		.run();
}

export async function listCalendarSubscriptionsForUser(userId: string): Promise<DbCalendarSubscription[]> {
	const db = getDb();
	return db
		.select()
		.from(calendarSubscriptions)
		.where(eq(calendarSubscriptions.userId, userId))
		.orderBy(asc(calendarSubscriptions.createdAt))
		.all();
}

export async function listEnabledCalendarSubscriptionsForUser(
	userId: string
): Promise<DbCalendarSubscription[]> {
	const db = getDb();
	return db
		.select()
		.from(calendarSubscriptions)
		.where(and(eq(calendarSubscriptions.userId, userId), eq(calendarSubscriptions.enabled, true)))
		.orderBy(asc(calendarSubscriptions.createdAt))
		.all();
}

export async function getCalendarSubscriptionForUser(
	id: string,
	userId: string
): Promise<DbCalendarSubscription | undefined> {
	const db = getDb();
	return db
		.select()
		.from(calendarSubscriptions)
		.where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)))
		.get();
}

export function getCalendarSubscriptionById(id: string): DbCalendarSubscription | undefined {
	const db = getDb();
	return db.select().from(calendarSubscriptions).where(eq(calendarSubscriptions.id, id)).get();
}

export async function setCalendarSubscriptionEnabled(
	id: string,
	userId: string,
	enabled: boolean
): Promise<void> {
	const db = getDb();
	db.update(calendarSubscriptions)
		.set({ enabled, updatedAt: new Date() })
		.where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)))
		.run();
}

export async function deleteCalendarSubscriptionForUser(id: string, userId: string): Promise<void> {
	const db = getDb();
	db.delete(calendarSubscriptions)
		.where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)))
		.run();
}

/** Record conditional-fetch state + last event count after a successful poll. */
export async function updateCalendarConditional(input: {
	id: string;
	etag: string | null;
	lastModified: string | null;
	lastEventCount: number;
}): Promise<void> {
	const db = getDb();
	db.update(calendarSubscriptions)
		.set({
			etag: input.etag,
			lastModified: input.lastModified,
			lastEventCount: input.lastEventCount,
			updatedAt: new Date()
		})
		.where(eq(calendarSubscriptions.id, input.id))
		.run();
}

export type CalendarAcquireOptions = {
	ignoreThrottle?: boolean;
	now?: number;
	throttleMs?: number;
	lockTtlMs?: number;
};

/**
 * Atomically claim the poll lock for one subscription. Same shape as
 * syncJobsRepository.tryAcquireSyncJob, but per-subscription (a user may have
 * several feeds, each polled on its own clock) and using the subscription row's
 * own lock/throttle/breaker columns. Returns true iff this caller should poll.
 */
export function tryAcquireCalendarSync(subscriptionId: string, opts: CalendarAcquireOptions = {}): boolean {
	const db = getDb();
	const now = opts.now ?? Date.now();
	const throttleMs = opts.throttleMs ?? getEnv().CALENDAR_SYNC_THROTTLE_MS;
	const lockTtlMs = opts.lockTtlMs ?? SYNC_LOCK_TTL_MS;

	return db.transaction((tx) => {
		const row = tx
			.select()
			.from(calendarSubscriptions)
			.where(eq(calendarSubscriptions.id, subscriptionId))
			.get();
		if (!row || !row.enabled) return false;

		const lockedAtMs = row.lockedAt ? row.lockedAt.getTime() : null;
		const lockIsLive = row.status === 'running' && lockedAtMs !== null && now - lockedAtMs < lockTtlMs;
		if (lockIsLive) return false;

		const cooldownMs = row.cooldownUntil ? row.cooldownUntil.getTime() : null;
		if (cooldownMs !== null && now < cooldownMs) {
			const hardCooldown = row.lastStatus === RATE_LIMITED_STATUS;
			if (hardCooldown || !opts.ignoreThrottle) return false;
		}

		const lastPolledMs = row.lastPolledAt ? row.lastPolledAt.getTime() : null;
		const throttled = !opts.ignoreThrottle && lastPolledMs !== null && now - lastPolledMs < throttleMs;
		if (throttled) return false;

		tx.update(calendarSubscriptions)
			.set({ status: 'running', lockedAt: new Date(now), lockedBy: INSTANCE_ID, updatedAt: new Date(now) })
			.where(eq(calendarSubscriptions.id, subscriptionId))
			.run();
		return true;
	});
}

export type CalendarSyncRelease = { ok: boolean; status: string; error?: string | null };

/** Release the lock and record the run. Success resets the breaker; failure
 * increments it and opens an escalating cool-down (reusing computeBackoffMs). */
export function releaseCalendarSync(
	subscriptionId: string,
	result: CalendarSyncRelease,
	now: number = Date.now()
): void {
	const db = getDb();
	// Read-decide-write in one transaction, and only release if THIS process still
	// owns the lock. A slow poll whose lock went stale and was reclaimed by a newer
	// poll must NOT clobber that newer poll's live lock or its breaker state.
	// Mirrors releaseSyncJob (syncJobsRepository.ts) exactly — the guard was
	// previously missing here, allowing two concurrent reconciles of one feed.
	db.transaction((tx) => {
		const prev = tx
			.select()
			.from(calendarSubscriptions)
			.where(eq(calendarSubscriptions.id, subscriptionId))
			.get();
		if (!prev || prev.lockedBy !== INSTANCE_ID) return; // lost the lock; nothing to release
		const consecutiveFailures = result.ok ? 0 : (prev.consecutiveFailures ?? 0) + 1;
		const cooldownUntil = result.ok
			? null
			: new Date(now + computeBackoffMs(consecutiveFailures, result.status));
		tx.update(calendarSubscriptions)
			.set({
				status: result.ok ? 'idle' : 'failed',
				lockedAt: null,
				lockedBy: null,
				lastPolledAt: new Date(now),
				lastStatus: result.status,
				lastError: result.error ?? null,
				consecutiveFailures,
				cooldownUntil,
				updatedAt: new Date(now)
			})
			.where(and(eq(calendarSubscriptions.id, subscriptionId), eq(calendarSubscriptions.lockedBy, INSTANCE_ID)))
			.run();
	});
}

export function isCalendarSyncRunning(
	row: Pick<DbCalendarSubscription, 'status' | 'lockedAt'>,
	now: number = Date.now(),
	lockTtlMs: number = SYNC_LOCK_TTL_MS
): boolean {
	if (row.status !== 'running' || !row.lockedAt) return false;
	return now - row.lockedAt.getTime() < lockTtlMs;
}
