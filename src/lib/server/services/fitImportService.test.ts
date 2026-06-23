import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDbForTests, getDb } from '$lib/server/db/client';
import { activityFiles, activities, importJobs } from '$lib/server/db/schema';
import { registerWithEmailPassword } from '$lib/server/services/authService';

// Local 7:30 AM — deterministic across server TZ since the Date constructor
// uses local time. The service composes a smart title from this, so we expect
// "Morning Run" regardless of what the parser returned as a placeholder title.
const MOCK_START = new Date(2026, 0, 1, 7, 30);

vi.mock('$lib/server/parsers/fit/fitParser', () => {
	return {
		parseFit: async () => ({
			summary: {
				sport: 'Run',
				title: 'Mock Activity',
				startTime: MOCK_START,
				durationSec: 3600,
				movingTimeSec: 3500,
				distanceM: 10000,
				elevationGainM: 100,
				avgHr: 140,
				maxHr: 175,
				avgPowerW: null,
				maxPowerW: null,
				avgCadence: 85,
				calories: 600
			},
			stream: { records: [{ t: 0 }], laps: [] },
			parserVersion: 'mock'
		})
	};
});

import { importFitUpload, DuplicateUploadError } from '$lib/server/services/fitImportService';

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

describe('fitImportService', () => {
	beforeEach(() => {
		const dbPath = `/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		setTestEnv(dbPath);
		resetDbForTests();
	});

	it('imports and stores summary + records import job', async () => {
		const bytes = new Uint8Array([1, 2, 3, 4]);
		const { user } = await registerWithEmailPassword({ email: 'u@example.com', password: 'password123' });
		const result = await importFitUpload({
			userId: user.id,
			originalFilename: 'test.fit',
			bytes
		});

		const db = getDb();
		const files = db.select().from(activityFiles).all();
		expect(files.length).toBe(1);
		expect(files[0]?.id).toBe(result.activityFileId);

		const acts = db.select().from(activities).all();
		expect(acts.length).toBe(1);
		// fitImportService now composes a Strava-style title (time-of-day + sport)
		// regardless of what parseFit returned. 7:30 AM local => "Morning Run".
		expect(acts[0]?.title).toBe('Morning Run');
		expect(acts[0]?.id).toBe(result.activityId);

		const jobs = db.select().from(importJobs).all();
		expect(jobs.length).toBe(1);
		expect(jobs[0]?.status).toBe('succeeded');
	});

	it('duplicate upload detected by sha256', async () => {
		const bytes = new Uint8Array([9, 9, 9]);
		const { user } = await registerWithEmailPassword({ email: 'u2@example.com', password: 'password123' });
		await importFitUpload({ userId: user.id, originalFilename: 'a.fit', bytes });
		await expect(importFitUpload({ userId: user.id, originalFilename: 'b.fit', bytes })).rejects.toBeInstanceOf(
			DuplicateUploadError
		);
	});
});
