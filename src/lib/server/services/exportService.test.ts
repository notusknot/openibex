import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { createActivityFile } from '$lib/server/repositories/activityFilesRepository';
import { createActivity } from '$lib/server/repositories/activitiesRepository';
import { createPlannedWorkoutForUser } from '$lib/server/services/plannedWorkoutsService';
import { writeUserExportToDisk, readExportManifest, readExportZipBytes } from '$lib/server/services/exportService';

function setTestEnv(dbPath: string, dataDir: string) {
	process.env.OPENIBEX_ENV = 'test';
	process.env.NODE_ENV = 'test';
	process.env.OPEN_REGISTRATION = 'true';
	process.env.SESSION_SECRET = 'test-secret-test-secret';
	process.env.SESSION_TTL_DAYS = '1';
	process.env.OPENIBEX_DATA_DIR = dataDir;
	process.env.OPENIBEX_UPLOAD_DIR = path.join(dataDir, 'uploads');
	process.env.OPENIBEX_STREAM_DIR = path.join(dataDir, 'streams');
	process.env.OPENIBEX_EXPORT_DIR = path.join(dataDir, 'exports');
	process.env.DATABASE_URL = `file:${dbPath}`;
}

describe('exportService', () => {
	beforeEach(async () => {
		const dataDir = `/tmp/openibex-export-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		await fs.mkdir(dataDir, { recursive: true });
		const dbPath = path.join(dataDir, 'openibex.db');
		setTestEnv(dbPath, dataDir);
		resetDbForTests();
	});

	it('writes export to disk and zip contains metadata files', async () => {
		const { user } = await registerWithEmailPassword({ email: 'e@example.com', password: 'password123' });

		await createPlannedWorkoutForUser({
			userId: user.id,
			sport: 'Run',
			scheduledDate: '2026-04-01',
			title: 'Planned',
			description: null,
			plannedDurationSec: 3600,
			plannedDistanceM: 10000,
			plannedLoad: 50
		});

		const sha256 = 'deadbeef';
		const relPath = `uploads/${user.id}/${sha256}.fit`;
		await fs.mkdir(path.join(process.env.OPENIBEX_DATA_DIR!, 'uploads', user.id), { recursive: true });
		await fs.writeFile(path.join(process.env.OPENIBEX_DATA_DIR!, relPath), new Uint8Array([1, 2, 3]));

		const fileId = 'file1';
		await createActivityFile({
			id: fileId,
			userId: user.id,
			originalFilename: 'x.fit',
			filePath: relPath,
			fileType: 'fit',
			sha256,
			sizeBytes: 3,
			uploadedAt: new Date('2026-04-01T12:00:00Z')
		});

		await createActivity({
			id: 'act1',
			userId: user.id,
			activityFileId: fileId,
			sport: 'Run',
			title: 'Completed',
			startTime: new Date('2026-04-01T12:00:00Z'),
			durationSec: 1800,
			distanceM: 5000
		});

		const { exportId } = await writeUserExportToDisk(user.id);
		const manifest = await readExportManifest(exportId);
		expect(manifest?.userId).toBe(user.id);

		const zipBytes = await readExportZipBytes(exportId, manifest!.filename);
		expect(zipBytes).toBeTruthy();

		const zip = await JSZip.loadAsync(zipBytes!);
		expect(zip.file('meta/version.json')).toBeTruthy();
		expect(zip.file('data/activities.json')).toBeTruthy();
		expect(zip.file('data/planned_workouts.json')).toBeTruthy();
		expect(zip.file('data/activity_files.json')).toBeTruthy();
		expect(zip.file(relPath)).toBeTruthy();
	});
});
