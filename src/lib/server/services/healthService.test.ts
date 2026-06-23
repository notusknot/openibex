import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { releaseSyncJob, tryAcquireSyncJob } from '$lib/server/repositories/syncJobsRepository';
import { getHealth } from '$lib/server/services/healthService';

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

describe('healthService', () => {
	beforeEach(() => {
		const dataDir = `/tmp/openibex-health-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		fs.mkdirSync(dataDir, { recursive: true });
		setTestEnv(dataDir);
		resetDbForTests();
	});

	it('reports ok with db up and no failing syncs on a fresh db', async () => {
		const h = await getHealth();
		expect(h.ok).toBe(true);
		expect(h.db).toBe('up');
		expect(h.syncFailing).toBe(0);
		expect(h.inFlightWrites).toBe(0);
		expect(typeof h.uptimeSeconds).toBe('number');
	});

	it('counts a failed/cooling-down sync job in syncFailing', async () => {
		const { user } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });
		tryAcquireSyncJob(user.id);
		releaseSyncJob(user.id, { ok: false, status: 'error', error: 'boom' });
		expect((await getHealth()).syncFailing).toBe(1);

		// A successful run clears it.
		tryAcquireSyncJob(user.id, { ignoreThrottle: true });
		releaseSyncJob(user.id, { ok: true, status: 'ok' });
		expect((await getHealth()).syncFailing).toBe(0);
	});
});
