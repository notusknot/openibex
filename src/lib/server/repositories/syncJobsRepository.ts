import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { syncJobs } from '$lib/server/db/schema';

export type DbSyncJob = typeof syncJobs.$inferSelect;

// Throttle: auto-sync runs at most once per window per user (matches the old
// in-memory behavior). Lock TTL: a sync may hold the lock this long before it's
// considered stale and reclaimable — covers a process dying mid-sync without
// releasing. Manual "Sync now" bypasses the throttle but still respects a live
// lock, so it can't collide with an in-flight auto-sync.
export const SYNC_THROTTLE_MS = 15 * 60 * 1000;
export const SYNC_LOCK_TTL_MS = 10 * 60 * 1000;

// Stable per-process id, recorded on the lock for debugging which instance holds
// it. Randomized suffix distinguishes restarts of the same pid.
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

export type AcquireOptions = {
	/** Bypass the throttle window (manual "Sync now"). Still honors a live lock. */
	ignoreThrottle?: boolean;
	/** Injectable clock + windows for deterministic tests. */
	now?: number;
	throttleMs?: number;
	lockTtlMs?: number;
};

/**
 * Atomically claim the sync lock for a user. Returns true iff the caller won and
 * should run the sync. The whole read-decide-write runs in one synchronous
 * better-sqlite3 transaction, so only one of two concurrent callers can win even
 * under contention — the guarantee the in-memory Set could never give.
 */
export function tryAcquireSyncJob(userId: string, opts: AcquireOptions = {}): boolean {
	const db = getDb();
	const now = opts.now ?? Date.now();
	const throttleMs = opts.throttleMs ?? SYNC_THROTTLE_MS;
	const lockTtlMs = opts.lockTtlMs ?? SYNC_LOCK_TTL_MS;

	return db.transaction((tx) => {
		const row = tx.select().from(syncJobs).where(eq(syncJobs.userId, userId)).get();

		if (!row) {
			tx.insert(syncJobs)
				.values({ userId, status: 'running', lockedAt: new Date(now), lockedBy: INSTANCE_ID })
				.run();
			return true;
		}

		const lockedAtMs = row.lockedAt ? row.lockedAt.getTime() : null;
		const lockIsLive = row.status === 'running' && lockedAtMs !== null && now - lockedAtMs < lockTtlMs;
		if (lockIsLive) return false; // someone else is actively syncing

		const lastRunMs = row.lastRunAt ? row.lastRunAt.getTime() : null;
		const throttled = !opts.ignoreThrottle && lastRunMs !== null && now - lastRunMs < throttleMs;
		if (throttled) return false;

		// Free or stale lock, and not throttled (or throttle bypassed): claim it.
		tx.update(syncJobs)
			.set({ status: 'running', lockedAt: new Date(now), lockedBy: INSTANCE_ID })
			.where(eq(syncJobs.userId, userId))
			.run();
		return true;
	});
}

export type SyncJobRelease = {
	ok: boolean;
	/** The SyncOutcome string (ok | auth_failed | error | …). */
	status: string;
	/** Already-redacted error message, if any. */
	error?: string | null;
};

/** Release the lock and record the run result (sets the throttle timestamp). */
export function releaseSyncJob(userId: string, result: SyncJobRelease, now: number = Date.now()): void {
	const db = getDb();
	db.update(syncJobs)
		.set({
			status: result.ok ? 'idle' : 'failed',
			lockedAt: null,
			lockedBy: null,
			lastRunAt: new Date(now),
			lastStatus: result.status,
			lastError: result.error ?? null
		})
		.where(eq(syncJobs.userId, userId))
		.run();
}

/** True iff a sync is running AND its lock is still live (not stale). A stale
 * 'running' row reads as not-running, so the UI never shows a stuck "syncing". */
export function isSyncJobRunning(
	userId: string,
	now: number = Date.now(),
	lockTtlMs: number = SYNC_LOCK_TTL_MS
): boolean {
	const db = getDb();
	const row = db.select().from(syncJobs).where(eq(syncJobs.userId, userId)).get();
	if (!row || row.status !== 'running' || !row.lockedAt) return false;
	return now - row.lockedAt.getTime() < lockTtlMs;
}

export function getSyncJob(userId: string): DbSyncJob | undefined {
	const db = getDb();
	return db.select().from(syncJobs).where(eq(syncJobs.userId, userId)).get();
}
