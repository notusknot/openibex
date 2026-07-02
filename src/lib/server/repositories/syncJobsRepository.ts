import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { syncJobs } from '$lib/server/db/schema';
import {
	isJobLockLive,
	JOB_LOCK_INSTANCE_ID,
	releaseJobLock,
	tryAcquireJobLock,
	type JobLockRelease,
	type JobLockState
} from '$lib/server/repositories/jobLock';

export type DbSyncJob = typeof syncJobs.$inferSelect;

// Throttle: auto-sync runs at most once per window per user. The lock TTL,
// backoff, and breaker semantics live in jobLock.ts — this repository only
// maps the sync_jobs columns onto that shared coordination lock.
export const SYNC_THROTTLE_MS = 15 * 60 * 1000;

export type AcquireOptions = {
	/** Bypass the throttle window (manual "Sync now"). Still honors a live lock. */
	ignoreThrottle?: boolean;
	/** Injectable clock + windows for deterministic tests. */
	now?: number;
	throttleMs?: number;
	lockTtlMs?: number;
};

function lockStateOf(row: DbSyncJob): JobLockState {
	return {
		status: row.status,
		lockedAt: row.lockedAt,
		lockedBy: row.lockedBy,
		lastAt: row.lastRunAt,
		lastStatus: row.lastStatus,
		consecutiveFailures: row.consecutiveFailures,
		cooldownUntil: row.cooldownUntil
	};
}

/** Atomically claim the sync lock for a user. Returns true iff the caller won
 * and should run the sync. Semantics (stale reclaim, hard/soft cool-down,
 * throttle) are jobLock's; the sync_jobs row is created on demand. */
export function tryAcquireSyncJob(userId: string, opts: AcquireOptions = {}): boolean {
	return tryAcquireJobLock({
		read: (tx) => {
			const row = tx.select().from(syncJobs).where(eq(syncJobs.userId, userId)).get();
			return row ? lockStateOf(row) : undefined;
		},
		insertFresh: (tx, lockedAt, lockedBy) => {
			tx.insert(syncJobs).values({ userId, status: 'running', lockedAt, lockedBy }).run();
		},
		claim: (tx, lockedAt, lockedBy) => {
			tx.update(syncJobs)
				.set({ status: 'running', lockedAt, lockedBy })
				.where(eq(syncJobs.userId, userId))
				.run();
		},
		ignoreThrottle: opts.ignoreThrottle,
		now: opts.now,
		throttleMs: opts.throttleMs ?? SYNC_THROTTLE_MS,
		lockTtlMs: opts.lockTtlMs
	});
}

/**
 * Heartbeat: refresh the lock's `lockedAt` so a long-running sync keeps its lock
 * live past the TTL and a concurrent auto-sync can't start a second run for the
 * same user. Renews ONLY IF this process still owns the lock (status 'running'
 * AND lockedBy === JOB_LOCK_INSTANCE_ID) — never steals back a lock another run
 * has since reclaimed. Returns true iff the lock was actually renewed.
 *
 * NOTE: the instance id is per-process, so this can't distinguish two runs in
 * the SAME process. The atomic acquire + this heartbeat make that case
 * unreachable in practice (an active run never goes stale), but a per-run lock
 * token would be the fully robust guard. See report TODO.
 */
export function renewSyncJobLock(userId: string, now: number = Date.now()): boolean {
	const db = getDb();
	const res = db
		.update(syncJobs)
		.set({ lockedAt: new Date(now) })
		.where(
			and(
				eq(syncJobs.userId, userId),
				eq(syncJobs.status, 'running'),
				eq(syncJobs.lockedBy, JOB_LOCK_INSTANCE_ID)
			)
		)
		.run();
	return res.changes > 0;
}

export type SyncJobRelease = JobLockRelease;

/** Release the lock and record the run result. On success the breaker resets; on
 * failure it increments the failure count and opens an (escalating) cool-down. */
export function releaseSyncJob(userId: string, result: SyncJobRelease, now: number = Date.now()): void {
	releaseJobLock({
		read: (tx) => tx.select().from(syncJobs).where(eq(syncJobs.userId, userId)).get(),
		write: (tx, next, owner) => {
			tx.update(syncJobs)
				.set({
					status: next.status,
					lockedAt: null,
					lockedBy: null,
					lastRunAt: next.lastAt,
					lastStatus: next.lastStatus,
					lastError: next.lastError,
					consecutiveFailures: next.consecutiveFailures,
					cooldownUntil: next.cooldownUntil
				})
				.where(and(eq(syncJobs.userId, userId), eq(syncJobs.lockedBy, owner)))
				.run();
		},
		result,
		now
	});
}

/** True iff a sync is running AND its lock is still live (not stale). A stale
 * 'running' row reads as not-running, so the UI never shows a stuck "syncing". */
export function isSyncJobRunning(userId: string, now: number = Date.now(), lockTtlMs?: number): boolean {
	const db = getDb();
	const row = db.select().from(syncJobs).where(eq(syncJobs.userId, userId)).get();
	if (!row) return false;
	return isJobLockLive(row, now, lockTtlMs);
}

export function getSyncJob(userId: string): DbSyncJob | undefined {
	const db = getDb();
	return db.select().from(syncJobs).where(eq(syncJobs.userId, userId)).get();
}
