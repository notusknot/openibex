import { beforeEach, describe, expect, it } from 'vitest';

import { resetDbForTests } from '$lib/server/db/client';
import {
	createPlannedWorkoutForUser,
	deletePlannedWorkoutForUserService,
	getPlannedWorkoutForEdit,
	listPlannedWorkouts,
	updatePlannedWorkoutForUserService
} from '$lib/server/services/plannedWorkoutsService';
import { registerWithEmailPassword } from '$lib/server/services/authService';

function setTestEnv(dbPath: string) {
	process.env.OPENIBEX_ENV = 'test';
	process.env.NODE_ENV = 'test';
	process.env.OPEN_REGISTRATION = 'true';
	process.env.SESSION_SECRET = 'test-secret-test-secret';
	process.env.SESSION_TTL_DAYS = '1';
	process.env.OPENIBEX_DATA_DIR = '/tmp/openibex-test';
	process.env.OPENIBEX_UPLOAD_DIR = '/tmp/openibex-test/uploads';
	process.env.OPENIBEX_STREAM_DIR = '/tmp/openibex-test/streams';
	process.env.DATABASE_URL = `file:${dbPath}`;
}

describe('plannedWorkoutsService', () => {
	beforeEach(() => {
		const dbPath = `/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		setTestEnv(dbPath);
		resetDbForTests();
	});

	it('create/edit/delete planned workout', async () => {
		const { user } = await registerWithEmailPassword({ email: 'pw1@example.com', password: 'password123' });

		const created = await createPlannedWorkoutForUser({
			userId: user.id,
			sport: 'Run',
			scheduledDate: '2026-01-15',
			title: 'Easy run',
			description: null,
			plannedDurationSec: 3600,
			plannedDistanceM: 10000,
			plannedLoad: 50
		});

		const fetched = await getPlannedWorkoutForEdit({ userId: user.id, id: created.id });
		expect(fetched?.title).toBe('Easy run');

		await updatePlannedWorkoutForUserService({
			userId: user.id,
			id: created.id,
			sport: 'Run',
			scheduledDate: '2026-01-16',
			title: 'Easy run (moved)',
			description: 'Keep it easy.',
			plannedDurationSec: 3300,
			plannedDistanceM: 9000,
			plannedLoad: 45
		});

		const updated = await getPlannedWorkoutForEdit({ userId: user.id, id: created.id });
		expect(updated?.scheduledDate).toBe('2026-01-16');
		expect(updated?.description).toBe('Keep it easy.');

		await deletePlannedWorkoutForUserService({ userId: user.id, id: created.id });
		const deleted = await getPlannedWorkoutForEdit({ userId: user.id, id: created.id });
		expect(deleted).toBeNull();
	});

	it('list planned workouts with sport filter', async () => {
		const { user } = await registerWithEmailPassword({ email: 'pw2@example.com', password: 'password123' });

		await createPlannedWorkoutForUser({
			userId: user.id,
			sport: 'Bike',
			scheduledDate: '2026-02-01',
			title: 'Endurance ride',
			description: null,
			plannedDurationSec: null,
			plannedDistanceM: null,
			plannedLoad: null
		});
		await createPlannedWorkoutForUser({
			userId: user.id,
			sport: 'Run',
			scheduledDate: '2026-02-02',
			title: 'Tempo',
			description: null,
			plannedDurationSec: null,
			plannedDistanceM: null,
			plannedLoad: null
		});

		const all = await listPlannedWorkouts({ userId: user.id, fromDate: '2026-02-01', toDate: '2026-02-28' });
		expect(all.length).toBe(2);

		const runs = await listPlannedWorkouts({
			userId: user.id,
			fromDate: '2026-02-01',
			toDate: '2026-02-28',
			sport: 'Run'
		});
		expect(runs.length).toBe(1);
		expect(runs[0]?.sport).toBe('Run');
	});

	it('ownership checks enforced (cannot edit others)', async () => {
		const { user: u1 } = await registerWithEmailPassword({ email: 'u1@example.com', password: 'password123' });
		const { user: u2 } = await registerWithEmailPassword({ email: 'u2@example.com', password: 'password123' });

		const created = await createPlannedWorkoutForUser({
			userId: u1.id,
			sport: 'Swim',
			scheduledDate: '2026-03-01',
			title: 'Swim drills',
			description: null,
			plannedDurationSec: null,
			plannedDistanceM: null,
			plannedLoad: null
		});

		await expect(
			updatePlannedWorkoutForUserService({
				userId: u2.id,
				id: created.id,
				sport: 'Swim',
				scheduledDate: '2026-03-02',
				title: 'Hacked',
				description: null,
				plannedDurationSec: null,
				plannedDistanceM: null,
				plannedLoad: null
			})
		).rejects.toThrow(/not found/i);
	});
});

