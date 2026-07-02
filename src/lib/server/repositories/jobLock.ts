import { getDb } from '$lib/server/db/client';

/**
 * The one durable coordination lock: DB-backed lock + throttle + exponential
 * backoff + circuit breaker, shared by every recurring per-row job (the Garmin
 * sync's `sync_jobs` row, each calendar subscription's poll state).
 *
 * The acquire/release SEMANTICS live here — stale-lock reclaim, hard vs soft
 * cool-down, throttle, ownership-guarded release, breaker escalation.
 * Consumers only map their table's columns through the small read/claim/write
 * adapters, so they cannot forget the ownership guard or drift on the breaker
 * rules (which happened once: releaseCalendarSync originally shipped without
 * the guard releaseSyncJob had).
 *
 * Coordination state is DB-backed deliberately: it survives restarts and is
 * shared across processes and tabs (see ARCHITECTURE.md). Don't reintroduce a
 * process-local map.
 */

/** A lock may be held this long before it's considered stale and reclaimable —
 * covers a process dying mid-run without releasing. */
export const JOB_LOCK_TTL_MS = 10 * 60 * 1000;

/** The release status that triggers the hard (manual-proof) cool-down. */
export const RATE_LIMITED_STATUS = 'rate_limited';

// Circuit breaker: after a failed run, hold off before retrying — a tight
// retry loop against the unofficial Garmin API can get the account banned.
// Generic errors back off from the base window; rate-limit (429) responses
// back off much harder, and that cool-down is honored even by a manual run.
// The calendar poller inherits the same policy.
export const JOB_ERROR_BACKOFF_BASE_MS = 15 * 60 * 1000; // 15 min
export const JOB_ERROR_BACKOFF_CAP_MS = 6 * 60 * 60 * 1000; // 6 h
export const JOB_RATE_LIMIT_BACKOFF_BASE_MS = 60 * 60 * 1000; // 1 h
export const JOB_RATE_LIMIT_BACKOFF_CAP_MS = 24 * 60 * 60 * 1000; // 24 h

/** Exponential backoff for the breaker: base * 2^(n-1), capped. Pure + exported
 * for unit testing. */
export function computeBackoffMs(consecutiveFailures: number, status: string): number {
	const n = Math.max(1, consecutiveFailures);
	const rateLimited = status === RATE_LIMITED_STATUS;
	const base = rateLimited ? JOB_RATE_LIMIT_BACKOFF_BASE_MS : JOB_ERROR_BACKOFF_BASE_MS;
	const cap = rateLimited ? JOB_RATE_LIMIT_BACKOFF_CAP_MS : JOB_ERROR_BACKOFF_CAP_MS;
	// Clamp the exponent so base * 2^(n-1) can't overflow before hitting the cap.
	const factor = 2 ** Math.min(n - 1, 30);
	return Math.min(base * factor, cap);
}

// Stable per-process id, recorded on the lock for debugging which instance
// holds it. Randomized suffix distinguishes restarts of the same pid. There is
// exactly ONE per process — acquire, renew, and release must all match on the
// same identity, across every coordinated table.
export const JOB_LOCK_INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

export type JobLockTx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

/** The lock/throttle/breaker state every coordinated job row carries. `lastAt`
 * is the row's "last completed run" timestamp (lastRunAt / lastPolledAt) — it
 * drives the throttle window. */
export type JobLockState = {
	status: string | null;
	lockedAt: Date | null;
	lockedBy: string | null;
	lastAt: Date | null;
	lastStatus: string | null;
	consecutiveFailures: number | null;
	cooldownUntil: Date | null;
};

export type TryAcquireJobLockInput = {
	/** Read the coordinated row's lock state inside the transaction. Return
	 * undefined when the row is missing — or must never be claimed (e.g. a
	 * disabled calendar subscription). */
	read: (tx: JobLockTx) => JobLockState | undefined;
	/** Claim the lock on the existing row. */
	claim: (tx: JobLockTx, lockedAt: Date, lockedBy: string) => void;
	/** Create the row already-locked when none exists (sync_jobs is created on
	 * demand). Omit to refuse acquisition when the row is missing. */
	insertFresh?: (tx: JobLockTx, lockedAt: Date, lockedBy: string) => void;
	/** Bypass the throttle window (a manual run). Still honors a live lock and
	 * a hard (rate-limited) cool-down. */
	ignoreThrottle?: boolean;
	/** Injectable clock + windows for deterministic tests. */
	now?: number;
	throttleMs: number;
	lockTtlMs?: number;
};

/**
 * Atomically claim the lock. Returns true iff the caller won and should run.
 * The whole read-decide-write runs in one synchronous better-sqlite3
 * transaction, so only one of two concurrent callers can win even under
 * contention — the guarantee a process-local map could never give.
 */
export function tryAcquireJobLock(input: TryAcquireJobLockInput): boolean {
	const db = getDb();
	const now = input.now ?? Date.now();
	const lockTtlMs = input.lockTtlMs ?? JOB_LOCK_TTL_MS;

	return db.transaction((tx) => {
		const row = input.read(tx);

		if (!row) {
			if (!input.insertFresh) return false;
			input.insertFresh(tx, new Date(now), JOB_LOCK_INSTANCE_ID);
			return true;
		}

		const lockedAtMs = row.lockedAt ? row.lockedAt.getTime() : null;
		const lockIsLive = row.status === 'running' && lockedAtMs !== null && now - lockedAtMs < lockTtlMs;
		if (lockIsLive) return false; // someone else is actively running

		// Circuit breaker: respect an open cool-down. A rate-limit cool-down is
		// "hard" — honored even by a manual run, to avoid hammering a 429'd API
		// into a ban. An ordinary error cool-down only gates auto runs; a manual
		// run may retry through it.
		const cooldownMs = row.cooldownUntil ? row.cooldownUntil.getTime() : null;
		if (cooldownMs !== null && now < cooldownMs) {
			const hardCooldown = row.lastStatus === RATE_LIMITED_STATUS;
			if (hardCooldown || !input.ignoreThrottle) return false;
		}

		const lastAtMs = row.lastAt ? row.lastAt.getTime() : null;
		const throttled = !input.ignoreThrottle && lastAtMs !== null && now - lastAtMs < input.throttleMs;
		if (throttled) return false;

		// Free or stale lock, and not throttled (or throttle bypassed): claim it.
		input.claim(tx, new Date(now), JOB_LOCK_INSTANCE_ID);
		return true;
	});
}

export type JobLockRelease = {
	ok: boolean;
	/** The run's outcome string (ok | auth_failed | error | rate_limited | …). */
	status: string;
	/** Already-redacted error message, if any. */
	error?: string | null;
};

/** The post-run state releaseJobLock computes; the write adapter persists it
 * (mapping `lastAt` onto its table's lastRunAt / lastPolledAt column) and MUST
 * scope its UPDATE to `lockedBy = owner`. */
export type JobLockWrite = {
	status: 'idle' | 'failed';
	lastAt: Date;
	lastStatus: string;
	lastError: string | null;
	consecutiveFailures: number;
	cooldownUntil: Date | null;
};

/**
 * Release the lock and record the run result. On success the breaker resets;
 * on failure it increments the failure count and opens an escalating
 * cool-down. Read-decide-write in one transaction, and only releases if THIS
 * process still owns the lock: a run whose lock went stale and was reclaimed
 * by a newer run must NOT clobber that newer run's lock or breaker state.
 */
export function releaseJobLock(input: {
	read: (tx: JobLockTx) => Pick<JobLockState, 'lockedBy' | 'consecutiveFailures'> | undefined;
	write: (tx: JobLockTx, next: JobLockWrite, owner: string) => void;
	result: JobLockRelease;
	now?: number;
}): void {
	const db = getDb();
	const now = input.now ?? Date.now();
	db.transaction((tx) => {
		const prev = input.read(tx);
		if (!prev || prev.lockedBy !== JOB_LOCK_INSTANCE_ID) return; // lost the lock; nothing to release
		const consecutiveFailures = input.result.ok ? 0 : (prev.consecutiveFailures ?? 0) + 1;
		const cooldownUntil = input.result.ok
			? null
			: new Date(now + computeBackoffMs(consecutiveFailures, input.result.status));
		input.write(
			tx,
			{
				status: input.result.ok ? 'idle' : 'failed',
				lastAt: new Date(now),
				lastStatus: input.result.status,
				lastError: input.result.error ?? null,
				consecutiveFailures,
				cooldownUntil
			},
			JOB_LOCK_INSTANCE_ID
		);
	});
}

/** True iff the row is running AND its lock is still live (not stale). A stale
 * 'running' row reads as not-running, so the UI never shows a stuck state. */
export function isJobLockLive(
	row: Pick<JobLockState, 'status' | 'lockedAt'>,
	now: number = Date.now(),
	lockTtlMs: number = JOB_LOCK_TTL_MS
): boolean {
	if (row.status !== 'running' || !row.lockedAt) return false;
	return now - row.lockedAt.getTime() < lockTtlMs;
}
