import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import {
	createCalendarSubscription,
	getCalendarSubscriptionById,
	releaseCalendarSync,
	setCalendarSubscriptionEnabled,
	tryAcquireCalendarSync
} from '$lib/server/repositories/calendarSubscriptionsRepository';
import {
	SYNC_ERROR_BACKOFF_BASE_MS,
	SYNC_RATE_LIMIT_BACKOFF_BASE_MS
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

const T0 = 1_700_000_000_000;
const THROTTLE = 1000;
const TTL = 500;
const win = (extra: { now: number; ignoreThrottle?: boolean }) => ({ throttleMs: THROTTLE, lockTtlMs: TTL, ...extra });

describe('calendarSubscriptionsRepository lock + throttle (per subscription)', () => {
	let subId: string;

	beforeEach(async () => {
		const dataDir = `/tmp/openibex-calsub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		fs.mkdirSync(dataDir, { recursive: true });
		setTestEnv(dataDir);
		resetDbForTests();
		const { user } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });
		subId = crypto.randomUUID();
		await createCalendarSubscription({ id: subId, userId: user.id, url: 'https://example.com/a.ics', label: 'A' });
	});

	it('lets exactly one of two concurrent callers win the lock', () => {
		expect(tryAcquireCalendarSync(subId, win({ now: T0 }))).toBe(true);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + 10 }))).toBe(false);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + 10, ignoreThrottle: true }))).toBe(false);
	});

	it('honors the throttle for auto-poll but lets a manual run bypass it', () => {
		expect(tryAcquireCalendarSync(subId, win({ now: T0 }))).toBe(true);
		releaseCalendarSync(subId, { ok: true, status: 'ok' }, T0 + 1);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + 100 }))).toBe(false);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + 100, ignoreThrottle: true }))).toBe(true);
	});

	it('reclaims a stale lock from a crashed run', () => {
		expect(tryAcquireCalendarSync(subId, win({ now: T0 }))).toBe(true);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + TTL - 1, ignoreThrottle: true }))).toBe(false);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + TTL + 1, ignoreThrottle: true }))).toBe(true);
	});

	it('refuses to acquire a disabled subscription', () => {
		setCalendarSubscriptionEnabled(subId, getCalendarSubscriptionById(subId)!.userId, false);
		expect(tryAcquireCalendarSync(subId, win({ now: T0, ignoreThrottle: true }))).toBe(false);
	});

	it('opens the breaker after a failure: auto blocked, manual may push a soft cool-down', () => {
		expect(tryAcquireCalendarSync(subId, win({ now: T0 }))).toBe(true);
		releaseCalendarSync(subId, { ok: false, status: 'error', error: 'boom' }, T0);
		const row = getCalendarSubscriptionById(subId)!;
		expect(row.consecutiveFailures).toBe(1);
		expect(row.cooldownUntil?.getTime()).toBe(T0 + SYNC_ERROR_BACKOFF_BASE_MS);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + 60_000 }))).toBe(false);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + 60_000, ignoreThrottle: true }))).toBe(true);
	});

	it('a rate-limit cool-down blocks even a manual run', () => {
		tryAcquireCalendarSync(subId, win({ now: T0 }));
		releaseCalendarSync(subId, { ok: false, status: 'rate_limited', error: '429' }, T0);
		expect(getCalendarSubscriptionById(subId)!.cooldownUntil?.getTime()).toBe(T0 + SYNC_RATE_LIMIT_BACKOFF_BASE_MS);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + 60_000, ignoreThrottle: true }))).toBe(false);
	});

	it('resets the breaker on a successful run', () => {
		tryAcquireCalendarSync(subId, win({ now: T0 }));
		releaseCalendarSync(subId, { ok: false, status: 'error' }, T0);
		expect(tryAcquireCalendarSync(subId, win({ now: T0 + 1000, ignoreThrottle: true }))).toBe(true);
		releaseCalendarSync(subId, { ok: true, status: 'ok' }, T0 + 1000);
		const row = getCalendarSubscriptionById(subId)!;
		expect(row.consecutiveFailures).toBe(0);
		expect(row.cooldownUntil).toBeNull();
	});
});
