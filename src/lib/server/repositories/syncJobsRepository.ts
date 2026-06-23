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

// Circuit breaker: after a failed run, hold off before retrying — a tight retry
// loop against the unofficial Garmin API can get the account banned. Generic
// errors back off from the throttle window; rate-limit (429) responses back off
// much harder, and that cool-down is honored even by a manual "Sync now".
export const SYNC_ERROR_BACKOFF_BASE_MS = 15 * 60 * 1000; // 15 min
export const SYNC_ERROR_BACKOFF_CAP_MS = 6 * 60 * 60 * 1000; // 6 h
export const SYNC_RATE_LIMIT_BACKOFF_BASE_MS = 60 * 60 * 1000; // 1 h
export const SYNC_RATE_LIMIT_BACKOFF_CAP_MS = 24 * 60 * 60 * 1000; // 24 h

/** The release status that triggers the hard (manual-proof) cool-down. */
export const RATE_LIMITED_STATUS = 'rate_limited';

/** Exponential backoff for the breaker: base * 2^(n-1), capped. Pure + exported
 * for unit testing. */
export function computeBackoffMs(consecutiveFailures: number, status: string): number {
	const n = Math.max(1, consecutiveFailures);
	const rateLimited = status === RATE_LIMITED_STATUS;
	const base = rateLimited ? SYNC_RATE_LIMIT_BACKOFF_BASE_MS : SYNC_ERROR_BACKOFF_BASE_MS;
	const cap = rateLimited ? SYNC_RATE_LIMIT_BACKOFF_CAP_MS : SYNC_ERROR_BACKOFF_CAP_MS;
	// Clamp the exponent so base * 2^(n-1) can't overflow before hitting the cap.
	const factor = 2 ** Math.min(n - 1, 30);
	return Math.min(base * factor, cap);
}

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

		// Circuit breaker: respect an open cool-down. A rate-limit cool-down is
		// "hard" — honored even by a manual run, to avoid hammering a 429'd API
		// into an account ban. An ordinary error cool-down only gates auto-sync;
		// a manual "Sync now" may retry through it.
		const cooldownMs = row.cooldownUntil ? row.cooldownUntil.getTime() : null;
		if (cooldownMs !== null && now < cooldownMs) {
			const hardCooldown = row.lastStatus === RATE_LIMITED_STATUS;
			if (hardCooldown || !opts.ignoreThrottle) return false;
		}

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

/** Release the lock and record the run result. On success the breaker resets; on
 * failure it increments the failure count and opens an (escalating) cool-down. */
export function releaseSyncJob(userId: string, result: SyncJobRelease, now: number = Date.now()): void {
	const db = getDb();
	const prev = db.select().from(syncJobs).where(eq(syncJobs.userId, userId)).get();
	const consecutiveFailures = result.ok ? 0 : (prev?.consecutiveFailures ?? 0) + 1;
	const cooldownUntil = result.ok
		? null
		: new Date(now + computeBackoffMs(consecutiveFailures, result.status));
	db.update(syncJobs)
		.set({
			status: result.ok ? 'idle' : 'failed',
			lockedAt: null,
			lockedBy: null,
			lastRunAt: new Date(now),
			lastStatus: result.status,
			lastError: result.error ?? null,
			consecutiveFailures,
			cooldownUntil
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
