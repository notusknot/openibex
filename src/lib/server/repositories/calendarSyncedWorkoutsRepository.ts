import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '$lib/server/db/client';
import {
	calendarSubscriptions,
	calendarSyncedWorkouts,
	plannedWorkouts,
	type Sport
} from '$lib/server/db/schema';
import type { DbPlannedWorkout } from '$lib/server/repositories/plannedWorkoutsRepository';

export type DbCalendarSyncedWorkout = typeof calendarSyncedWorkouts.$inferSelect;

// The managed planned-workout fields a synced row owns. Structurally identical
// to MappedWorkout (services/sync/calendarMapping) so the service passes one in
// directly, without the repository importing up into the service layer.
export type PlannedWorkoutFields = {
	sport: Sport;
	scheduledDate: string;
	title: string;
	description: string | null;
	plannedDurationSec: number | null;
	plannedDistanceM: number | null;
	plannedLoad: number | null;
};

export type UpstreamSignals = { sequence: number | null; lastModified: string | null };

/** A link row paired with its current planned workout (null if tombstoned). The
 * sync reconciler loads all of these once per subscription, then diffs. */
export type LinkWithWorkout = { link: DbCalendarSyncedWorkout; workout: DbPlannedWorkout | null };

export async function listSyncedWorkoutsForSubscription(
	subscriptionId: string
): Promise<LinkWithWorkout[]> {
	const db = getDb();
	const rows = db
		.select({ link: calendarSyncedWorkouts, workout: plannedWorkouts })
		.from(calendarSyncedWorkouts)
		.leftJoin(plannedWorkouts, eq(calendarSyncedWorkouts.plannedWorkoutId, plannedWorkouts.id))
		.where(eq(calendarSyncedWorkouts.subscriptionId, subscriptionId))
		.all();
	return rows.map((r) => ({ link: r.link, workout: r.workout ?? null }));
}

/** The synced-workout link for a given planned workout (for the edit page's
 * conflict banner / provenance badge), joined with its subscription label. */
export async function getSyncedWorkoutForPlannedWorkout(
	plannedWorkoutId: string,
	userId: string
): Promise<{ link: DbCalendarSyncedWorkout; subscriptionLabel: string } | null> {
	const db = getDb();
	const row = db
		.select({ link: calendarSyncedWorkouts, subscriptionLabel: calendarSubscriptions.label })
		.from(calendarSyncedWorkouts)
		.innerJoin(
			calendarSubscriptions,
			eq(calendarSyncedWorkouts.subscriptionId, calendarSubscriptions.id)
		)
		.where(
			and(
				eq(calendarSyncedWorkouts.plannedWorkoutId, plannedWorkoutId),
				eq(calendarSyncedWorkouts.userId, userId)
			)
		)
		.get();
	return row ? { link: row.link, subscriptionLabel: row.subscriptionLabel } : null;
}

export async function countConflictsForUser(userId: string): Promise<number> {
	const db = getDb();
	const row = db
		.select({ c: sql<number>`count(*)` })
		.from(calendarSyncedWorkouts)
		.where(and(eq(calendarSyncedWorkouts.userId, userId), eq(calendarSyncedWorkouts.state, 'conflict')))
		.get();
	return row?.c ?? 0;
}

// ── Reconcile writes (the repo applies the decision the pure reconciler made) ──

/** New event → create the planned workout and its link row atomically. */
export async function createSyncedWorkout(input: {
	plannedWorkoutId: string;
	linkId: string;
	subscriptionId: string;
	userId: string;
	icalUid: string;
	recurrenceId: string;
	fields: PlannedWorkoutFields;
	syncedHash: string;
	signals: UpstreamSignals;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.transaction((tx) => {
		tx.insert(plannedWorkouts)
			.values({ id: input.plannedWorkoutId, userId: input.userId, ...input.fields, createdAt: now, updatedAt: now })
			.run();
		tx.insert(calendarSyncedWorkouts)
			.values({
				id: input.linkId,
				subscriptionId: input.subscriptionId,
				userId: input.userId,
				icalUid: input.icalUid,
				recurrenceId: input.recurrenceId,
				plannedWorkoutId: input.plannedWorkoutId,
				syncedHash: input.syncedHash,
				upstreamSequence: input.signals.sequence,
				upstreamLastModified: input.signals.lastModified,
				state: 'synced',
				createdAt: now,
				updatedAt: now
			})
			.run();
	});
}

/** Untouched + upstream changed → overwrite the workout and re-baseline. */
export async function updateSyncedWorkout(input: {
	linkId: string;
	plannedWorkoutId: string;
	userId: string;
	fields: PlannedWorkoutFields;
	syncedHash: string;
	signals: UpstreamSignals;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.transaction((tx) => {
		tx.update(plannedWorkouts)
			.set({ ...input.fields, updatedAt: now })
			.where(and(eq(plannedWorkouts.id, input.plannedWorkoutId), eq(plannedWorkouts.userId, input.userId)))
			.run();
		tx.update(calendarSyncedWorkouts)
			.set({
				syncedHash: input.syncedHash,
				upstreamSequence: input.signals.sequence,
				upstreamLastModified: input.signals.lastModified,
				state: 'synced',
				conflictJson: null,
				conflictHash: null,
				removedUpstream: false,
				updatedAt: now
			})
			.where(eq(calendarSyncedWorkouts.id, input.linkId))
			.run();
	});
}

/** User edited + upstream unchanged → stop auto-overwriting (keep their version). */
export async function markSyncedWorkoutUserModified(linkId: string): Promise<void> {
	const db = getDb();
	db.update(calendarSyncedWorkouts)
		.set({ state: 'user_modified', removedUpstream: false, updatedAt: new Date() })
		.where(eq(calendarSyncedWorkouts.id, linkId))
		.run();
}

/** User edited + upstream changed → flag for review, keeping the user's workout
 * and stashing the upstream version for the diff. (Same op for first-flag and
 * refresh-when-coach-edits-again.) */
export async function markSyncedWorkoutConflict(input: {
	linkId: string;
	conflictJson: string;
	conflictHash: string;
	signals: UpstreamSignals;
}): Promise<void> {
	const db = getDb();
	db.update(calendarSyncedWorkouts)
		.set({
			state: 'conflict',
			conflictJson: input.conflictJson,
			conflictHash: input.conflictHash,
			upstreamSequence: input.signals.sequence,
			upstreamLastModified: input.signals.lastModified,
			updatedAt: new Date()
		})
		.where(eq(calendarSyncedWorkouts.id, input.linkId))
		.run();
}

/** Untouched + gone upstream → remove workout and link together. */
export async function deleteSyncedWorkout(input: {
	linkId: string;
	plannedWorkoutId: string;
	userId: string;
}): Promise<void> {
	const db = getDb();
	db.transaction((tx) => {
		tx.delete(calendarSyncedWorkouts).where(eq(calendarSyncedWorkouts.id, input.linkId)).run();
		tx.delete(plannedWorkouts)
			.where(and(eq(plannedWorkouts.id, input.plannedWorkoutId), eq(plannedWorkouts.userId, input.userId)))
			.run();
	});
}

/** User edited + gone upstream → keep the workout but flag it cancelled. */
export async function markSyncedWorkoutCancelled(linkId: string): Promise<void> {
	const db = getDb();
	db.update(calendarSyncedWorkouts)
		.set({ state: 'cancelled', removedUpstream: true, updatedAt: new Date() })
		.where(eq(calendarSyncedWorkouts.id, linkId))
		.run();
}

// ── Conflict resolution (driven by the user from the edit page) ───────────────

/** "Apply coach's version" → overwrite the workout with the upstream version. */
export async function applyCoachVersion(input: {
	linkId: string;
	plannedWorkoutId: string;
	userId: string;
	fields: PlannedWorkoutFields;
	syncedHash: string;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.transaction((tx) => {
		tx.update(plannedWorkouts)
			.set({ ...input.fields, updatedAt: now })
			.where(and(eq(plannedWorkouts.id, input.plannedWorkoutId), eq(plannedWorkouts.userId, input.userId)))
			.run();
		tx.update(calendarSyncedWorkouts)
			.set({ state: 'synced', syncedHash: input.syncedHash, conflictJson: null, conflictHash: null, updatedAt: now })
			.where(and(eq(calendarSyncedWorkouts.id, input.linkId), eq(calendarSyncedWorkouts.userId, input.userId)))
			.run();
	});
}

/** "Keep mine" → accept the new upstream baseline (so the same change won't
 * re-flag) without changing the user's workout. */
export async function keepUserVersion(input: {
	linkId: string;
	userId: string;
	syncedHash: string;
}): Promise<void> {
	const db = getDb();
	db.update(calendarSyncedWorkouts)
		.set({ state: 'user_modified', syncedHash: input.syncedHash, conflictJson: null, conflictHash: null, updatedAt: new Date() })
		.where(and(eq(calendarSyncedWorkouts.id, input.linkId), eq(calendarSyncedWorkouts.userId, input.userId)))
		.run();
}
