import { beforeEach, describe, expect, it } from 'vitest';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { createImportItem, listImportItemsForBatchUser } from '$lib/server/repositories/importItemsRepository';
import {
	createImportBatch,
	failOrphanedImportBatches,
	getImportBatchForUser
} from '$lib/server/repositories/importBatchesRepository';

function setTestEnv(dbPath: string) {
	process.env.OPENIBEX_ENV = 'test';
	process.env.NODE_ENV = 'test';
	process.env.OPEN_REGISTRATION = 'true';
	process.env.SESSION_SECRET = 'test-secret-test-secret';
	process.env.SESSION_TTL_DAYS = '1';
	process.env.OPENIBEX_DATA_DIR = '/tmp/openibex-test';
	process.env.DATABASE_URL = `file:${dbPath}`;
}

describe('failOrphanedImportBatches', () => {
	beforeEach(() => {
		setTestEnv(`/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
		resetDbForTests();
	});

	it('marks interrupted (processing/pending) batches + their in-flight items failed, leaving terminal ones alone', async () => {
		const { user } = await registerWithEmailPassword({ email: 'b@example.com', password: 'password123' });

		await createImportBatch({ id: 'b-proc', userId: user.id, source: 'garmin-export', originalName: 'a.zip', status: 'processing' });
		await createImportBatch({ id: 'b-done', userId: user.id, source: 'garmin-export', originalName: 'b.zip', status: 'completed' });
		await createImportItem({
			id: 'i-proc', batchId: 'b-proc', userId: user.id, sourcePath: 'x', originalFilename: 'x.fit',
			detectedFormat: 'fit', fileSizeBytes: 10, sha256: 'sha-x', status: 'processing'
		});
		await createImportItem({
			id: 'i-done', batchId: 'b-proc', userId: user.id, sourcePath: 'y', originalFilename: 'y.fit',
			detectedFormat: 'fit', fileSizeBytes: 10, sha256: 'sha-y', status: 'imported'
		});

		const swept = failOrphanedImportBatches();
		expect(swept).toBe(1);

		const proc = await getImportBatchForUser('b-proc', user.id);
		expect(proc?.status).toBe('failed');
		expect(proc?.completedAt).toBeTruthy();

		const done = await getImportBatchForUser('b-done', user.id);
		expect(done?.status).toBe('completed'); // untouched

		const items = await listImportItemsForBatchUser({ batchId: 'b-proc', userId: user.id, limit: 100 });
		expect(items.find((i) => i.id === 'i-proc')?.status).toBe('failed');
		expect(items.find((i) => i.id === 'i-done')?.status).toBe('imported'); // terminal item untouched

		// Idempotent: a second sweep finds nothing.
		expect(failOrphanedImportBatches()).toBe(0);
	});
});
