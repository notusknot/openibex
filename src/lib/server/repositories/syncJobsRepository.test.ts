import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import {
	computeBackoffMs,
	getSyncJob,
	isSyncJobRunning,
	releaseSyncJob,
	tryAcquireSyncJob,
	SYNC_ERROR_BACKOFF_BASE_MS,
	SYNC_ERROR_BACKOFF_CAP_MS,
	SYNC_RATE_LIMIT_BACKOFF_BASE_MS,
	SYNC_RATE_LIMIT_BACKOFF_CAP_MS
} from '$lib/server/repositories/syncJobsRepository';

function setTestEnv(dataDir: string) {
	process.env.OPENIBEX_ENV = 'test';
	process.env.NODE_ENV = 'test';
	process.env.OPEN_REGISTRATION = 'true';
	process.env.SESSION_SECRET = 'test-secret-test-secret';
	process.env.SESSION_TTL_DAYS = '1';
	process.env.OPENIBEX_DATA_DIR = dataDir;
	process.env.OPENIBEX_UPLOAD_DIR = path.join(dataDir, 'uploads');
	process.env.OPENIBEX_STREAM_DIR = path.join(dataDir, 'streams');
	process.env.OPENIBEX_EXPORT_DIR = path.join(dataDir, 'exports');
	process.env.OPENIBEX_IMPORT_DIR = path.join(dataDir, 'imports');
	process.env.DATABASE_URL = `file:${path.join(dataDir, 'openibex.db')}`;
}

// Fixed clock + small windows so the lock/throttle behavior is deterministic.
const T0 = 1_700_000_000_000;
const THROTTLE = 1000;
const TTL = 500;
const win = (extra: { now: number; ignoreThrottle?: boolean }) => ({
	throttleMs: THROTTLE,
	lockTtlMs: TTL,
	...extra
});

describe('syncJobsRepository lock + throttle', () => {
	let userId: string;

	beforeEach(async () => {
		const dataDir = `/tmp/openibex-syncjobs-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		fs.mkdirSync(dataDir, { recursive: true });
		setTestEnv(dataDir);
		resetDbForTests();
		const { user } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });
		userId = user.id;
	});

	it('lets exactly one of two concurrent callers win the lock', () => {
		expect(tryAcquireSyncJob(userId, win({ now: T0 }))).toBe(true);
		// Lock is live: a second caller — even a manual one — must lose.
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 10 }))).toBe(false);
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 10, ignoreThrottle: true }))).toBe(false);
	});

	it('honors the throttle for auto-sync but lets a manual run bypass it', () => {
		expect(tryAcquireSyncJob(userId, win({ now: T0 }))).toBe(true);
		releaseSyncJob(userId, { ok: true, status: 'ok' }, T0 + 1);

		// Within the throttle window: auto-sync blocked, manual allowed.
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 100 }))).toBe(false);
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 100, ignoreThrottle: true }))).toBe(true);
		releaseSyncJob(userId, { ok: true, status: 'ok' }, T0 + 101);

		// Past the throttle window: auto-sync allowed again.
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 101 + THROTTLE }))).toBe(true);
	});

	it('reclaims a stale lock left behind by a crashed run', () => {
		expect(tryAcquireSyncJob(userId, win({ now: T0 }))).toBe(true);
		// No release (process "crashed"). Within the TTL the lock still holds.
		expect(tryAcquireSyncJob(userId, win({ now: T0 + TTL - 1, ignoreThrottle: true }))).toBe(false);
		// Past the TTL the lock is stale and the next run reclaims it.
		expect(tryAcquireSyncJob(userId, win({ now: T0 + TTL + 1, ignoreThrottle: true }))).toBe(true);
	});

	it('isSyncJobRunning reports a live lock but not a stale or released one', () => {
		tryAcquireSyncJob(userId, win({ now: T0 }));
		expect(isSyncJobRunning(userId, T0 + 10, TTL)).toBe(true);
		expect(isSyncJobRunning(userId, T0 + TTL + 1, TTL)).toBe(false); // stale
		releaseSyncJob(userId, { ok: true, status: 'ok' }, T0 + 20);
		expect(isSyncJobRunning(userId, T0 + 21, TTL)).toBe(false); // released
	});

	it('release records the run outcome and clears the lock', () => {
		tryAcquireSyncJob(userId, win({ now: T0 }));
		releaseSyncJob(userId, { ok: false, status: 'auth_failed', error: 'reconnect needed' }, T0 + 5);

		const job = getSyncJob(userId)!;
		expect(job.status).toBe('failed');
		expect(job.lockedAt).toBeNull();
		expect(job.lockedBy).toBeNull();
		expect(job.lastStatus).toBe('auth_failed');
		expect(job.lastError).toBe('reconnect needed');
		expect(job.lastRunAt?.getTime()).toBe(T0 + 5);
	});

	it('computeBackoffMs escalates and caps per status', () => {
		// Generic error: base, then doubling, capped.
		expect(computeBackoffMs(1, 'error')).toBe(SYNC_ERROR_BACKOFF_BASE_MS);
		expect(computeBackoffMs(2, 'error')).toBe(SYNC_ERROR_BACKOFF_BASE_MS * 2);
		expect(computeBackoffMs(99, 'error')).toBe(SYNC_ERROR_BACKOFF_CAP_MS);
		// Rate-limit starts higher and caps higher.
		expect(computeBackoffMs(1, 'rate_limited')).toBe(SYNC_RATE_LIMIT_BACKOFF_BASE_MS);
		expect(computeBackoffMs(99, 'rate_limited')).toBe(SYNC_RATE_LIMIT_BACKOFF_CAP_MS);
	});

	it('opens the breaker after a failure: auto blocked, manual may retry a soft cool-down', () => {
		expect(tryAcquireSyncJob(userId, win({ now: T0 }))).toBe(true);
		releaseSyncJob(userId, { ok: false, status: 'error', error: 'boom' }, T0);

		const job = getSyncJob(userId)!;
		expect(job.consecutiveFailures).toBe(1);
		expect(job.cooldownUntil?.getTime()).toBe(T0 + SYNC_ERROR_BACKOFF_BASE_MS);

		// Auto-sync is blocked during the cool-down even though the throttle elapsed.
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 60_000 }))).toBe(false);
		// A manual run may push through a soft (non-rate-limit) cool-down.
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 60_000, ignoreThrottle: true }))).toBe(true);
	});

	it('a rate-limit cool-down blocks even a manual run', () => {
		expect(tryAcquireSyncJob(userId, win({ now: T0 }))).toBe(true);
		releaseSyncJob(userId, { ok: false, status: 'rate_limited', error: '429' }, T0);

		expect(getSyncJob(userId)!.cooldownUntil?.getTime()).toBe(T0 + SYNC_RATE_LIMIT_BACKOFF_BASE_MS);
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 60_000 }))).toBe(false);
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 60_000, ignoreThrottle: true }))).toBe(false);
	});

	it('escalates the cool-down on consecutive failures and resets on success', () => {
		tryAcquireSyncJob(userId, win({ now: T0 }));
		releaseSyncJob(userId, { ok: false, status: 'error' }, T0);
		expect(getSyncJob(userId)!.consecutiveFailures).toBe(1);

		// Re-acquire through the soft cool-down and fail again — escalates.
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 1000, ignoreThrottle: true }))).toBe(true);
		releaseSyncJob(userId, { ok: false, status: 'error' }, T0 + 1000);
		const job2 = getSyncJob(userId)!;
		expect(job2.consecutiveFailures).toBe(2);
		expect(job2.cooldownUntil?.getTime()).toBe(T0 + 1000 + SYNC_ERROR_BACKOFF_BASE_MS * 2);

		// A success clears the breaker.
		expect(tryAcquireSyncJob(userId, win({ now: T0 + 2000, ignoreThrottle: true }))).toBe(true);
		releaseSyncJob(userId, { ok: true, status: 'ok' }, T0 + 2000);
		const job3 = getSyncJob(userId)!;
		expect(job3.consecutiveFailures).toBe(0);
		expect(job3.cooldownUntil).toBeNull();
	});
});
