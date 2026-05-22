import { beforeEach, describe, expect, it } from 'vitest';

import crypto from 'node:crypto';

import { resetDbForTests, getDb } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { createPlannedWorkoutForUser } from '$lib/server/services/plannedWorkoutsService';
import { createActivity } from '$lib/server/repositories/activitiesRepository';
import { workoutLinks } from '$lib/server/db/schema';
import { ensureAutoMatchesForRange, setManualLink, computeCompliance } from '$lib/server/services/workoutMatchingService';
import { deleteWorkoutLinkForPlannedWorkout } from '$lib/server/repositories/workoutLinksRepository';

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

describe('workoutMatchingService', () => {
	beforeEach(() => {
		const dbPath = `/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		setTestEnv(dbPath);
		resetDbForTests();
	});

	it('computeCompliance returns ratios when both sides present', () => {
		const c = computeCompliance({
			plannedDurationSec: 100,
			plannedDistanceM: 2000,
			plannedLoad: 50,
			completedDurationSec: 80,
			completedDistanceM: 2200,
			completedLoad: 25
		});
		expect(c.duration).toBeCloseTo(0.8);
		expect(c.distance).toBeCloseTo(1.1);
		expect(c.load).toBeCloseTo(0.5);
	});

	it('auto-matches planned workout to completed activity by date+sport', async () => {
		const { user } = await registerWithEmailPassword({ email: 'm1@example.com', password: 'password123' });

		const planned = await createPlannedWorkoutForUser({
			userId: user.id,
			sport: 'Run',
			scheduledDate: '2026-02-15',
			title: 'Planned run',
			description: null,
			plannedDurationSec: 3600,
			plannedDistanceM: 10000,
			plannedLoad: null
		});

		const activityId = crypto.randomUUID();
		await createActivity({
			id: activityId,
			userId: user.id,
			activityFileId: null,
			sport: 'Run',
			title: 'Completed run',
			startTime: new Date('2026-02-15T10:00:00'),
			durationSec: 4000,
			distanceM: 9000
		});

		await ensureAutoMatchesForRange({ userId: user.id, fromDate: '2026-02-01', toDate: '2026-02-28' });

		const db = getDb();
		const links = db.select().from(workoutLinks).all();
		expect(links.length).toBe(1);
		expect(links[0]?.plannedWorkoutId).toBe(planned.id);
		expect(links[0]?.activityId).toBe(activityId);
		expect(links[0]?.matchType).toBe('auto');
		expect(links[0]?.durationCompliance).toBeCloseTo(4000 / 3600);
		expect(links[0]?.distanceCompliance).toBeCloseTo(9000 / 10000);
	});

	it('manual link can be set and removed', async () => {
		const { user } = await registerWithEmailPassword({ email: 'm2@example.com', password: 'password123' });

		const planned = await createPlannedWorkoutForUser({
			userId: user.id,
			sport: 'Bike',
			scheduledDate: '2026-03-10',
			title: 'Planned ride',
			description: null,
			plannedDurationSec: null,
			plannedDistanceM: null,
			plannedLoad: null
		});

		const activityId = crypto.randomUUID();
		await createActivity({
			id: activityId,
			userId: user.id,
			activityFileId: null,
			sport: 'Bike',
			title: 'Completed ride',
			startTime: new Date('2026-03-10T08:00:00'),
			durationSec: 1000
		});

		await setManualLink({ userId: user.id, plannedWorkoutId: planned.id, activityId });
		let links = getDb().select().from(workoutLinks).all();
		expect(links.length).toBe(1);
		expect(links[0]?.matchType).toBe('manual');

		await deleteWorkoutLinkForPlannedWorkout(user.id, planned.id);
		links = getDb().select().from(workoutLinks).all();
		expect(links.length).toBe(0);
	});
});

