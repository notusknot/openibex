import { beforeEach, describe, expect, it, vi } from 'vitest';

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { resetDbForTests, getDb } from '$lib/server/db/client';
import { activities, importBatches, importItems } from '$lib/server/db/schema';
import { registerWithEmailPassword } from '$lib/server/services/authService';

vi.mock('$lib/server/parsers/fit/fitParser', () => {
	return {
		parseFit: async (_bytes: Uint8Array, originalFilename: string) => {
			if (originalFilename.toLowerCase().includes('bad')) {
				throw new Error('Invalid FIT');
			}
			return {
				summary: {
					sport: 'Run',
					title: `Imported ${originalFilename}`,
					startTime: new Date('2026-01-01T12:00:00Z'),
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
			};
		}
	};
});

import { importGarminHistoricalExport } from '$lib/server/services/imports/garminImportService';

async function mkTmpDir(prefix: string): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

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
	process.env.OPENIBEX_IMPORT_DIR = path.join(dataDir, 'imports');
	process.env.DATABASE_URL = `file:${dbPath}`;
}

async function writeGarminFit(root: string, name: string, bytes: Uint8Array) {
	const dir = path.join(root, 'DI_CONNECT', 'DI-Connect-Fitness-Uploaded-Files');
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(path.join(dir, name), bytes);
}

describe('garminImportService', () => {
	beforeEach(async () => {
		const dbPath = `/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		const dataDir = await mkTmpDir('openibex-garmin-data-');
		setTestEnv(dbPath, dataDir);
		resetDbForTests();
	});

	it('successful import creates an activity and batch records', async () => {
		const { user } = await registerWithEmailPassword({ email: 'u@example.com', password: 'password123' });
		const exportRoot = await mkTmpDir('openibex-garmin-export-');
		await writeGarminFit(exportRoot, '123.fit', new Uint8Array([1, 2, 3]));

		const result = await importGarminHistoricalExport({ userEmail: user.email, path: exportRoot });
		expect(result.importedCount).toBe(1);
		expect(result.failedCount).toBe(0);

		const db = getDb();
		expect(db.select().from(activities).all().length).toBe(1);
		expect(db.select().from(importBatches).all().length).toBe(1);
		expect(db.select().from(importItems).all().length).toBe(1);
	});

	it('duplicate SHA-256 detection skips duplicates safely', async () => {
		const { user } = await registerWithEmailPassword({ email: 'dup@example.com', password: 'password123' });
		const exportRoot = await mkTmpDir('openibex-garmin-export-');
		const bytes = new Uint8Array([9, 9, 9]);
		await writeGarminFit(exportRoot, '111.fit', bytes);
		await writeGarminFit(exportRoot, '222.fit', bytes);

		const result = await importGarminHistoricalExport({ userEmail: user.email, path: exportRoot });
		expect(result.importedCount).toBe(1);
		expect(result.duplicateCount).toBe(1);
		expect(result.failedCount).toBe(0);

		const db = getDb();
		expect(db.select().from(activities).all().length).toBe(1);
	});

	it('corrupt FIT marks the item failed without aborting the batch', async () => {
		const { user } = await registerWithEmailPassword({ email: 'bad@example.com', password: 'password123' });
		const exportRoot = await mkTmpDir('openibex-garmin-export-');
		await writeGarminFit(exportRoot, 'bad.fit', new Uint8Array([1]));
		await writeGarminFit(exportRoot, 'good.fit', new Uint8Array([2]));

		const result = await importGarminHistoricalExport({ userEmail: user.email, path: exportRoot });
		expect(result.importedCount).toBe(1);
		expect(result.failedCount).toBe(1);

		const db = getDb();
		const items = db.select().from(importItems).all();
		expect(items.some((x) => x.status === 'failed')).toBe(true);
		expect(items.some((x) => x.status === 'imported')).toBe(true);
	});

	it('rerunning the same import does not duplicate activities', async () => {
		const { user } = await registerWithEmailPassword({ email: 'rerun@example.com', password: 'password123' });
		const exportRoot = await mkTmpDir('openibex-garmin-export-');
		await writeGarminFit(exportRoot, '333.fit', new Uint8Array([5, 6, 7]));

		await importGarminHistoricalExport({ userEmail: user.email, path: exportRoot });
		const second = await importGarminHistoricalExport({ userEmail: user.email, path: exportRoot });
		expect(second.importedCount).toBe(0);
		expect(second.duplicateCount).toBe(1);

		const db = getDb();
		expect(db.select().from(activities).all().length).toBe(1);
	});

	it('users cannot view another user’s import batch via repository scoping', async () => {
		const { user: u1 } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });
		const { user: u2 } = await registerWithEmailPassword({ email: 'b@example.com', password: 'password123' });
		const exportRoot = await mkTmpDir('openibex-garmin-export-');
		await writeGarminFit(exportRoot, '444.fit', new Uint8Array([1, 2, 3, 4]));

		const r = await importGarminHistoricalExport({ userEmail: u2.email, path: exportRoot });
		const { getImportBatchForUser } = await import('$lib/server/repositories/importBatchesRepository');
		const found = await getImportBatchForUser(r.batchId, u1.id);
		expect(found).toBeUndefined();
	});
});

