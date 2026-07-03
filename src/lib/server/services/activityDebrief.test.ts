import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { saveActivityDebrief } from '$lib/server/services/activityDetailService';
import {
	createActivity,
	getActivityByIdForUser,
	getLatestUndebriefedActivityForUser
} from '$lib/server/repositories/activitiesRepository';
import { getCommentForTarget } from '$lib/server/repositories/commentsRepository';

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

describe('saveActivityDebrief', () => {
	let userId: string;

	beforeEach(async () => {
		const dataDir = `/tmp/openibex-debrief-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		fs.mkdirSync(dataDir, { recursive: true });
		setTestEnv(dataDir);
		resetDbForTests();
		const { user } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });
		userId = user.id;
		await createActivity({
			id: 'act1',
			userId,
			activityFileId: null,
			sport: 'Swim',
			title: 'Morning swim',
			startTime: new Date()
		});
	});

	const target = () => ({ userId, targetType: 'activity' as const, targetId: 'act1' });

	it('saves rpe + grade on the activity and the note as its comment', async () => {
		expect(
			await saveActivityDebrief({ userId, activityId: 'act1', rpe: 7, grade: 'B', note: ' felt strong ' })
		).toBe(true);
		const a = await getActivityByIdForUser('act1', userId);
		expect(a?.rpe).toBe(7);
		expect(a?.debriefGrade).toBe('B');
		expect((await getCommentForTarget(target()))?.body).toBe('felt strong');
	});

	it('updates in place and deletes the comment when the note is cleared', async () => {
		await saveActivityDebrief({ userId, activityId: 'act1', rpe: 7, grade: 'B', note: 'felt strong' });
		await saveActivityDebrief({ userId, activityId: 'act1', rpe: 4, grade: null, note: '' });
		const a = await getActivityByIdForUser('act1', userId);
		expect(a?.rpe).toBe(4);
		expect(a?.debriefGrade).toBeNull();
		expect(await getCommentForTarget(target())).toBeUndefined();
	});

	it('rejects out-of-range rpe and unknown grades', async () => {
		expect(await saveActivityDebrief({ userId, activityId: 'act1', rpe: 11, grade: null, note: '' })).toBe(false);
		expect(await saveActivityDebrief({ userId, activityId: 'act1', rpe: 5.5, grade: null, note: '' })).toBe(false);
		expect(await saveActivityDebrief({ userId, activityId: 'act1', rpe: null, grade: 'E', note: '' })).toBe(false);
	});

	it("rejects another user's activity", async () => {
		const { user: other } = await registerWithEmailPassword({ email: 'b@example.com', password: 'password123' });
		expect(
			await saveActivityDebrief({ userId: other.id, activityId: 'act1', rpe: 5, grade: null, note: 'x' })
		).toBe(false);
	});

	it('clears the debrief nudge once rated', async () => {
		const since = new Date(Date.now() - 60_000);
		expect((await getLatestUndebriefedActivityForUser({ userId, since }))?.id).toBe('act1');
		await saveActivityDebrief({ userId, activityId: 'act1', rpe: 6, grade: null, note: '' });
		expect(await getLatestUndebriefedActivityForUser({ userId, since })).toBeUndefined();
	});
});
