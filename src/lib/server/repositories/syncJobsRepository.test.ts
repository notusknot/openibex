import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import {
	getSyncJob,
	isSyncJobRunning,
	releaseSyncJob,
	tryAcquireSyncJob
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
});
