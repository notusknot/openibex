import { beforeEach, describe, expect, it, vi } from 'vitest';

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import JSZip from 'jszip';

import { resetDbForTests, getDb } from '$lib/server/db/client';
import { activities, importBatches, importItems } from '$lib/server/db/schema';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { createImportBatch } from '$lib/server/repositories/importBatchesRepository';

// Mirror the parseFit mock used by garminImportService.test.ts so this exercises
// the discovery → extract → dedup → commit path without a real FIT decoder.
vi.mock('$lib/server/parsers/fit/fitParser', () => {
	class FitNotAnActivityError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'FitNotAnActivityError';
		}
	}
	return {
		FitNotAnActivityError,
		parseFit: async (_bytes: Uint8Array, originalFilename: string) => {
			const lower = originalFilename.toLowerCase();
			if (lower.includes('bad')) throw new Error('Invalid FIT');
			if (lower.includes('sessionless')) {
				throw new FitNotAnActivityError('FIT file has no session message (mock).');
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

import { processGarminExportZip } from '$lib/server/services/imports/garminWebImportService';

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

/**
 * Build a Garmin-export-shaped zip in memory: FIT files live under
 * DI_CONNECT/DI-Connect-Fitness-Uploaded-Files, exactly as a real export lays
 * them out, so discovery/dedup behave as they would in production.
 */
async function buildExportZip(files: Array<{ name: string; bytes: number[] }>): Promise<Buffer> {
	const zip = new JSZip();
	for (const f of files) {
		zip.file(`DI_CONNECT/DI-Connect-Fitness-Uploaded-Files/${f.name}`, Buffer.from(f.bytes));
	}
	return zip.generateAsync({ type: 'nodebuffer' });
}

/** Stage an uploaded zip the way startGarminExportImport does, minus the fire-and-forget. */
async function stageZip(zipBytes: Buffer): Promise<{ batchId: string; workDir: string; zipPath: string }> {
	const batchId = crypto.randomUUID();
	const workDir = await mkTmpDir(`openibex-webimport-${batchId}-`);
	const zipPath = path.join(workDir, 'export.zip');
	await fs.writeFile(zipPath, zipBytes);
	return { batchId, workDir, zipPath };
}

async function preCreateBatch(batchId: string, userId: string, originalName: string) {
	await createImportBatch({
		id: batchId,
		userId,
		source: 'garmin-export',
		originalName,
		status: 'processing',
		startedAt: new Date()
	});
}

describe('garminWebImportService.processGarminExportZip', () => {
	beforeEach(async () => {
		const dbPath = `/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		const dataDir = await mkTmpDir('openibex-webimport-data-');
		setTestEnv(dbPath, dataDir);
		resetDbForTests();
	});

	it('imports activities from an uploaded export zip and reuses the pre-created batch', async () => {
		const { user } = await registerWithEmailPassword({ email: 'web@example.com', password: 'password123' });
		const zipBytes = await buildExportZip([{ name: '123.fit', bytes: [1, 2, 3] }]);
		const { batchId, workDir, zipPath } = await stageZip(zipBytes);
		await preCreateBatch(batchId, user.id, 'garmin-export.zip');

		const result = await processGarminExportZip({ userEmail: user.email, batchId, workDir, zipPath });

		expect(result.batchId).toBe(batchId);
		expect(result.importedCount).toBe(1);
		expect(result.failedCount).toBe(0);

		const db = getDb();
		// No second batch row — the web path reuses the one it pre-created.
		const batches = db.select().from(importBatches).all();
		expect(batches.length).toBe(1);
		expect(batches[0]!.id).toBe(batchId);
		expect(batches[0]!.originalName).toBe('garmin-export.zip');
		expect(batches[0]!.status).toBe('completed');
		expect(db.select().from(activities).all().length).toBe(1);
		expect(db.select().from(importItems).all().length).toBe(1);
	});

	it('de-duplicates identical FIT files within the same upload', async () => {
		const { user } = await registerWithEmailPassword({ email: 'dup@example.com', password: 'password123' });
		const zipBytes = await buildExportZip([
			{ name: '111.fit', bytes: [9, 9, 9] },
			{ name: '222.fit', bytes: [9, 9, 9] }
		]);
		const { batchId, workDir, zipPath } = await stageZip(zipBytes);
		await preCreateBatch(batchId, user.id, 'garmin-export.zip');

		const result = await processGarminExportZip({ userEmail: user.email, batchId, workDir, zipPath });

		expect(result.importedCount).toBe(1);
		expect(result.duplicateCount).toBe(1);
		expect(getDb().select().from(activities).all().length).toBe(1);
	});

	it('re-uploading the same export does not create duplicate activities', async () => {
		const { user } = await registerWithEmailPassword({ email: 'rerun@example.com', password: 'password123' });
		const zipBytes = await buildExportZip([{ name: '333.fit', bytes: [5, 6, 7] }]);

		const first = await stageZip(zipBytes);
		await preCreateBatch(first.batchId, user.id, 'export.zip');
		await processGarminExportZip({ userEmail: user.email, batchId: first.batchId, workDir: first.workDir, zipPath: first.zipPath });

		const second = await stageZip(zipBytes);
		await preCreateBatch(second.batchId, user.id, 'export.zip');
		const result = await processGarminExportZip({ userEmail: user.email, batchId: second.batchId, workDir: second.workDir, zipPath: second.zipPath });

		expect(result.importedCount).toBe(0);
		expect(result.duplicateCount).toBe(1);
		expect(getDb().select().from(activities).all().length).toBe(1);
	});

	it('removes its scratch workspace when done', async () => {
		const { user } = await registerWithEmailPassword({ email: 'clean@example.com', password: 'password123' });
		const zipBytes = await buildExportZip([{ name: '444.fit', bytes: [1, 2, 3, 4] }]);
		const { batchId, workDir, zipPath } = await stageZip(zipBytes);
		await preCreateBatch(batchId, user.id, 'export.zip');

		await processGarminExportZip({ userEmail: user.email, batchId, workDir, zipPath });

		await expect(fs.stat(workDir)).rejects.toThrow();
	});

	it('marks corrupt FIT files failed without aborting the batch', async () => {
		const { user } = await registerWithEmailPassword({ email: 'bad@example.com', password: 'password123' });
		const zipBytes = await buildExportZip([
			{ name: 'bad.fit', bytes: [1] },
			{ name: 'good.fit', bytes: [2] }
		]);
		const { batchId, workDir, zipPath } = await stageZip(zipBytes);
		await preCreateBatch(batchId, user.id, 'export.zip');

		const result = await processGarminExportZip({ userEmail: user.email, batchId, workDir, zipPath });

		expect(result.importedCount).toBe(1);
		expect(result.failedCount).toBe(1);
		const items = getDb().select().from(importItems).all();
		expect(items.some((x) => x.status === 'failed')).toBe(true);
		expect(items.some((x) => x.status === 'imported')).toBe(true);
	});
});
