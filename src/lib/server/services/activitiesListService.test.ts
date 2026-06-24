import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { createActivity } from '$lib/server/repositories/activitiesRepository';
import { getActivitiesList } from '$lib/server/services/activitiesListService';

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

describe('getActivitiesList', () => {
	let userId: string;

	beforeEach(async () => {
		const dataDir = `/tmp/openibex-actlist-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		fs.mkdirSync(dataDir, { recursive: true });
		setTestEnv(dataDir);
		resetDbForTests();
		const { user } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });
		userId = user.id;
	});

	// Day i => later startTime, so a higher index is newer.
	async function seed(count: number, overrides: (i: number) => Partial<Parameters<typeof createActivity>[0]> = () => ({})) {
		for (let i = 0; i < count; i++) {
			await createActivity({
				id: `a${i}`,
				userId,
				activityFileId: null,
				sport: 'Run',
				title: `Activity ${i}`,
				startTime: new Date(2026, 0, 1 + i, 7, 0, 0),
				...overrides(i)
			});
		}
	}

	it('loads the full set when no limit is given (not capped at 50/500), newest first', async () => {
		await seed(120);
		const data = await getActivitiesList({ userId });
		expect(data.rows.length).toBe(120);
		expect(data.totalCount).toBe(120);
		expect(data.rows[0]?.id).toBe('a119'); // newest
		expect(data.rows.at(-1)?.id).toBe('a0'); // oldest
		// startTimeMs is present and monotonically decreasing (sortable by date)
		expect(data.rows[0]?.startTimeMs).toBe(new Date(2026, 0, 120, 7, 0, 0).getTime());
		expect(data.rows[0]!.startTimeMs).toBeGreaterThan(data.rows.at(-1)!.startTimeMs);
	});

	it('builds a lowercased searchText from title + description', async () => {
		await seed(1, () => ({ title: 'Morning Tempo', description: 'INTERVALS at threshold' }));
		const { rows } = await getActivitiesList({ userId });
		expect(rows[0]?.searchText).toBe('morning tempo intervals at threshold');
	});

	it('tolerates a null description in searchText', async () => {
		await seed(1, () => ({ title: 'Easy Spin', description: null }));
		const { rows } = await getActivitiesList({ userId });
		expect(rows[0]?.searchText).toBe('easy spin ');
	});

	it('honors an explicit limit (recent-N) while reporting the full count', async () => {
		await seed(20);
		const data = await getActivitiesList({ userId, limit: 5 });
		expect(data.rows.length).toBe(5);
		expect(data.totalCount).toBe(20);
		expect(data.rows[0]?.id).toBe('a19'); // newest
	});

	it('scopes results to the requesting user', async () => {
		await seed(3);
		const { user: other } = await registerWithEmailPassword({ email: 'b@example.com', password: 'password123' });
		await createActivity({
			id: 'other-1',
			userId: other.id,
			activityFileId: null,
			sport: 'Bike',
			title: 'Not mine',
			startTime: new Date(2026, 5, 1, 7, 0, 0)
		});

		const mine = await getActivitiesList({ userId });
		expect(mine.rows.map((r) => r.id).sort()).toEqual(['a0', 'a1', 'a2']);
	});
});
