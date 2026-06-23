import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';

import { getDb, resetDbForTests } from '$lib/server/db/client';
import { sessions } from '$lib/server/db/schema';

function setTestEnv(dataDir: string) {
	process.env.OPENIBEX_ENV = 'test';
	process.env.NODE_ENV = 'test';
	process.env.SESSION_SECRET = 'test-secret-test-secret';
	process.env.SESSION_TTL_DAYS = '1';
	process.env.OPENIBEX_DATA_DIR = dataDir;
	process.env.OPENIBEX_UPLOAD_DIR = path.join(dataDir, 'uploads');
	process.env.OPENIBEX_STREAM_DIR = path.join(dataDir, 'streams');
	process.env.OPENIBEX_EXPORT_DIR = path.join(dataDir, 'exports');
	process.env.OPENIBEX_IMPORT_DIR = path.join(dataDir, 'imports');
	process.env.DATABASE_URL = `file:${path.join(dataDir, 'openibex.db')}`;
}

describe('sqlite connection pragmas', () => {
	beforeEach(() => {
		const dataDir = `/tmp/openibex-pragmas-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		fs.mkdirSync(dataDir, { recursive: true });
		setTestEnv(dataDir);
		resetDbForTests();
	});

	it('opens in WAL mode with NORMAL synchronous, a busy timeout, and FK enforcement on', () => {
		const db = getDb();
		expect((db.get(sql`PRAGMA journal_mode`) as { journal_mode: string }).journal_mode).toBe('wal');
		expect((db.get(sql`PRAGMA synchronous`) as { synchronous: number }).synchronous).toBe(1); // NORMAL
		expect((db.get(sql`PRAGMA busy_timeout`) as { timeout: number }).timeout).toBe(5000);
		expect((db.get(sql`PRAGMA foreign_keys`) as { foreign_keys: number }).foreign_keys).toBe(1);
	});

	it('rejects a child row with a dangling FK (proves enforcement is ON, not silently ignored)', () => {
		const db = getDb();
		expect(() =>
			db
				.insert(sessions)
				.values({
					id: 'orphan-session',
					userId: 'nonexistent-user',
					sessionTokenHash: 'hash',
					expiresAt: new Date()
				})
				.run()
		).toThrow(/FOREIGN KEY/i);
	});

	it('materializes the -wal and -shm sidecar files', () => {
		getDb(); // migrations run on first access, forcing a WAL write
		const dbPath = path.join(process.env.OPENIBEX_DATA_DIR!, 'openibex.db');
		expect(fs.existsSync(`${dbPath}-wal`)).toBe(true);
		expect(fs.existsSync(`${dbPath}-shm`)).toBe(true);
	});
});
