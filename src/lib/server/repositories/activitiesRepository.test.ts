import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { getDb, resetDbForTests } from '$lib/server/db/client';
import { activities, activityFiles } from '$lib/server/db/schema';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import {
	commitActivityWithFile,
	type CreateActivityInput
} from '$lib/server/repositories/activitiesRepository';
import type { CreateActivityFileInput } from '$lib/server/repositories/activityFilesRepository';

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

describe('commitActivityWithFile', () => {
	let userId: string;

	beforeEach(async () => {
		const dataDir = `/tmp/openibex-actrepo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		fs.mkdirSync(dataDir, { recursive: true });
		setTestEnv(dataDir);
		resetDbForTests();
		const { user } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });
		userId = user.id;
	});

	const file = (id: string): CreateActivityFileInput => ({
		id,
		userId,
		originalFilename: `${id}.fit`,
		filePath: `uploads/${userId}/${id}.fit`,
		fileType: 'fit',
		sha256: id,
		sizeBytes: 3,
		uploadedAt: new Date('2026-01-01T07:00:00')
	});
	const activity = (id: string, fileId: string): CreateActivityInput => ({
		id,
		userId,
		activityFileId: fileId,
		sport: 'Run',
		title: 'T',
		startTime: new Date('2026-01-01T07:00:00')
	});

	it('commits the file and activity rows together', () => {
		commitActivityWithFile({ file: file('f1'), activity: activity('a1', 'f1') });
		const db = getDb();
		expect(db.select().from(activityFiles).all().length).toBe(1);
		expect(db.select().from(activities).all().length).toBe(1);
	});

	it('rolls back the file insert when the activity insert fails', () => {
		commitActivityWithFile({ file: file('f1'), activity: activity('a1', 'f1') });

		// Reuse activity id a1 (primary-key conflict) with a NEW file f2. The file
		// insert runs first and succeeds, then the activity insert throws — the
		// whole transaction must roll back, leaving f2 unwritten.
		expect(() => commitActivityWithFile({ file: file('f2'), activity: activity('a1', 'f2') })).toThrow();

		const db = getDb();
		expect(db.select().from(activityFiles).all().map((r) => r.id)).toEqual(['f1']);
		expect(db.select().from(activities).all().length).toBe(1);
	});
});
