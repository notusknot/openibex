import { beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { createPlannedWorkoutForUser } from '$lib/server/services/plannedWorkoutsService';
import { createActivity } from '$lib/server/repositories/activitiesRepository';
import { createWorkoutLink } from '$lib/server/repositories/workoutLinksRepository';
import { getWeeklyAnalytics, getFitnessSeries } from '$lib/server/services/analytics/analyticsService';
import { fallbackLoadScore } from '$lib/server/services/analytics/load';

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

describe('analyticsService', () => {
	beforeEach(() => {
		const dbPath = `/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		setTestEnv(dbPath);
		resetDbForTests();
	});

	it('fallbackLoadScore uses sport factors', () => {
		expect(fallbackLoadScore({ sport: 'Bike', durationSec: 3600 })!).toBeCloseTo(60);
		expect(fallbackLoadScore({ sport: 'Run', durationSec: 3600 })!).toBeCloseTo(70);
		expect(fallbackLoadScore({ sport: 'Strength', durationSec: 3600 })!).toBeCloseTo(50);
	});

	it('weekly aggregation sums completed + planned and computes compliance from linked totals', async () => {
		const { user } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });

		const planned = await createPlannedWorkoutForUser({
			userId: user.id,
			sport: 'Run',
			scheduledDate: '2026-01-06', // Tue, week starting 2026-01-05
			title: 'Plan',
			description: null,
			plannedDurationSec: 3600,
			plannedDistanceM: 10000,
			plannedLoad: 100
		});

		const activityId = crypto.randomUUID();
		await createActivity({
			id: activityId,
			userId: user.id,
			activityFileId: null,
			sport: 'Run',
			title: 'Done',
			startTime: new Date('2026-01-06T10:00:00'),
			durationSec: 1800,
			distanceM: 5000,
			elevationGainM: 200,
			loadScore: 50
		});

		await createWorkoutLink({
			id: crypto.randomUUID(),
			userId: user.id,
			activityId,
			plannedWorkoutId: planned.id,
			matchType: 'manual',
			durationCompliance: 0.5,
			distanceCompliance: 0.5,
			loadCompliance: 0.5
		});

		const weekly = await getWeeklyAnalytics({ userId: user.id, fromDate: '2026-01-01', toDate: '2026-01-31' });
		const row = weekly.find((w) => w.weekStart === '2026-01-05');
		expect(row).toBeTruthy();
		expect(row!.completed.durationSec).toBe(1800);
		expect(row!.completed.distanceM).toBe(5000);
		expect(row!.completed.elevationM).toBe(200);
		expect(row!.completed.load).toBeCloseTo(50);
		expect(row!.planned.durationSec).toBe(3600);
		expect(row!.planned.distanceM).toBe(10000);
		expect(row!.planned.load).toBe(100);
		expect(row!.compliance.durationPct).toBeCloseTo(0.5);
		expect(row!.compliance.distancePct).toBeCloseTo(0.5);
		expect(row!.compliance.loadPct).toBeCloseTo(0.5);
	});

	it('fitness/fatigue/freshness uses rolling averages (42d/7d defaults)', async () => {
		const { user } = await registerWithEmailPassword({ email: 'b@example.com', password: 'password123' });
		await createActivity({
			id: crypto.randomUUID(),
			userId: user.id,
			activityFileId: null,
			sport: 'Bike',
			title: 'Ride',
			startTime: new Date('2026-02-01T10:00:00'),
			durationSec: 3600,
			loadScore: 60
		});
		const series = await getFitnessSeries({ userId: user.id, fromDate: '2026-02-01', toDate: '2026-02-07' });
		expect(series.length).toBe(7);
		const d1 = series[0]!;
		expect(d1.load).toBe(60);
		expect(d1.fitness).toBeCloseTo(60);
		expect(d1.fatigue).toBeCloseTo(60);
		const d2 = series[1]!;
		expect(d2.load).toBe(0);
		// rolling avg over 2 days
		expect(d2.fitness).toBeCloseTo(30);
		expect(d2.fatigue).toBeCloseTo(30);
	});
});

