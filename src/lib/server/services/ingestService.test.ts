import { beforeEach, describe, expect, it, vi } from 'vitest';

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { resetDbForTests, getDb } from '$lib/server/db/client';
import { activities, activityFiles, activityStreamMetrics } from '$lib/server/db/schema';
import { registerWithEmailPassword } from '$lib/server/services/authService';

// Deterministic mock parser: the fingerprint (sport + start + duration +
// distance) varies with byte LENGTH, so tests can force a fingerprint match
// (same length, different bytes) or miss (different length) at will.
const MOCK_START = new Date(2026, 0, 1, 7, 30);

vi.mock('$lib/server/parsers/fit/fitParser', () => {
	class FitNotAnActivityError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'FitNotAnActivityError';
		}
	}
	return {
		FitNotAnActivityError,
		parseFit: async (bytes: Uint8Array, originalFilename: string) => {
			if (originalFilename.toLowerCase().includes('sessionless')) {
				throw new FitNotAnActivityError('FIT file has no session message (mock).');
			}
			return {
				summary: {
					sport: 'Run',
					title: 'Mock Activity',
					startTime: MOCK_START,
					durationSec: 3600 + bytes.length,
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
				stream: { records: [{ heart_rate: 150 }], laps: [] },
				parserVersion: 'mock'
			};
		}
	};
});

import { ingestFitActivity } from '$lib/server/services/ingestService';

let dataDir: string;

function setTestEnv(dbPath: string, dir: string) {
	process.env.OPENIBEX_ENV = 'test';
	process.env.NODE_ENV = 'test';
	process.env.OPEN_REGISTRATION = 'true';
	process.env.SESSION_SECRET = 'test-secret-test-secret';
	process.env.SESSION_TTL_DAYS = '1';
	process.env.OPENIBEX_DATA_DIR = dir;
	process.env.OPENIBEX_UPLOAD_DIR = path.join(dir, 'uploads');
	process.env.OPENIBEX_STREAM_DIR = path.join(dir, 'streams');
	process.env.DATABASE_URL = `file:${dbPath}`;
}

function sha256Hex(bytes: Uint8Array): string {
	return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function registerUser(email: string) {
	const { user } = await registerWithEmailPassword({ email, password: 'password123' });
	return user;
}

describe('ingestService — the canonical 3-layer dedup guarantee', () => {
	beforeEach(async () => {
		const dbPath = `/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openibex-ingest-'));
		setTestEnv(dbPath, dataDir);
		resetDbForTests();
	});

	it('imports: commits activity + file + metrics with full provenance, original on disk', async () => {
		const user = await registerUser('u@example.com');
		const bytes = new Uint8Array([1, 2, 3, 4]);

		const outcome = await ingestFitActivity({
			userId: user.id,
			bytes,
			filename: 'morning.fit',
			provenance: { source: 'upload' },
			originalDest: { kind: 'uploads' },
			titleMetadata: null
		});

		expect(outcome.kind).toBe('imported');
		if (outcome.kind !== 'imported') return;

		const db = getDb();
		const act = db.select().from(activities).all()[0]!;
		expect(act.id).toBe(outcome.activityId);
		expect(act.source).toBe('upload');
		expect(act.sourceFileSha256).toBe(sha256Hex(bytes));
		expect(act.sourceFilename).toBe('morning.fit');
		expect(act.title).toBe('Morning Run'); // smart title, 7:30 local

		expect(db.select().from(activityFiles).all()[0]?.id).toBe(outcome.activityFileId);
		expect(db.select().from(activityStreamMetrics).all()[0]?.activityId).toBe(outcome.activityId);

		const original = path.join(dataDir, 'uploads', user.id, `${sha256Hex(bytes)}.fit`);
		await expect(fs.readFile(original)).resolves.toBeDefined();
	});

	it('import-batch destination: original lands under imports/<batchId>/originals/', async () => {
		const user = await registerUser('u@example.com');
		const bytes = new Uint8Array([1, 2, 3, 4]);

		const outcome = await ingestFitActivity({
			userId: user.id,
			bytes,
			filename: '123.fit',
			provenance: { source: 'garmin-export', sourceActivityId: '123' },
			originalDest: { kind: 'import-batch', batchId: 'batch-1' },
			titleMetadata: null
		});

		expect(outcome.kind).toBe('imported');
		const original = path.join(dataDir, 'imports', 'batch-1', 'originals', `${sha256Hex(bytes)}.fit`);
		await expect(fs.readFile(original)).resolves.toBeDefined();
	});

	it('layer 1 source-id: matches ACROSS garmin-export and garmin-sync', async () => {
		const user = await registerUser('u@example.com');
		const first = await ingestFitActivity({
			userId: user.id,
			bytes: new Uint8Array([1, 2, 3, 4]),
			filename: '42.fit',
			provenance: { source: 'garmin-export', sourceActivityId: '42' },
			originalDest: { kind: 'import-batch', batchId: 'b' },
			titleMetadata: null
		});
		expect(first.kind).toBe('imported');

		// Different bytes AND different length (→ different sha and fingerprint):
		// only the shared Garmin activity id can catch this one.
		const second = await ingestFitActivity({
			userId: user.id,
			bytes: new Uint8Array([9, 9, 9, 9, 9, 9]),
			filename: '42.fit',
			provenance: { source: 'garmin-sync', sourceActivityId: '42' },
			originalDest: { kind: 'uploads' },
			titleMetadata: null
		});
		expect(second).toMatchObject({
			kind: 'duplicate',
			layer: 'source-id',
			activityId: first.kind === 'imported' ? first.activityId : null
		});
		expect(getDb().select().from(activities).all().length).toBe(1);
	});

	it('layer 2 sha-256: byte-identical file is a duplicate regardless of name or path', async () => {
		const user = await registerUser('u@example.com');
		const bytes = new Uint8Array([7, 7, 7]);
		const first = await ingestFitActivity({
			userId: user.id,
			bytes,
			filename: 'a.fit',
			provenance: { source: 'upload' },
			originalDest: { kind: 'uploads' },
			titleMetadata: null
		});
		const second = await ingestFitActivity({
			userId: user.id,
			bytes,
			filename: 'b.fit',
			provenance: { source: 'garmin-sync', sourceActivityId: 'other-id' },
			originalDest: { kind: 'uploads' },
			titleMetadata: null
		});
		expect(second).toMatchObject({
			kind: 'duplicate',
			layer: 'sha256',
			activityId: first.kind === 'imported' ? first.activityId : null,
			sha256: sha256Hex(bytes)
		});
	});

	it('layer 3 fingerprint: byte-different re-encode of the same activity is a duplicate', async () => {
		const user = await registerUser('u@example.com');
		const first = await ingestFitActivity({
			userId: user.id,
			bytes: new Uint8Array([1, 2, 3, 4]),
			filename: 'ride.fit',
			provenance: { source: 'upload' },
			originalDest: { kind: 'uploads' },
			titleMetadata: null
		});
		// Same length (→ same mock fingerprint), different bytes (→ different sha).
		const second = await ingestFitActivity({
			userId: user.id,
			bytes: new Uint8Array([5, 6, 7, 8]),
			filename: 'ride-reexport.fit',
			provenance: { source: 'upload' },
			originalDest: { kind: 'uploads' },
			titleMetadata: null
		});
		expect(second).toMatchObject({
			kind: 'duplicate',
			layer: 'fingerprint',
			activityId: first.kind === 'imported' ? first.activityId : null
		});
		expect(getDb().select().from(activities).all().length).toBe(1);
	});

	it('unsupported (sessionless FIT) is an outcome, not an error — and writes nothing', async () => {
		const user = await registerUser('u@example.com');
		const bytes = new Uint8Array([1]);
		const outcome = await ingestFitActivity({
			userId: user.id,
			bytes,
			filename: 'sessionless.fit',
			provenance: { source: 'upload' },
			originalDest: { kind: 'uploads' },
			titleMetadata: null
		});
		expect(outcome.kind).toBe('unsupported');
		expect(getDb().select().from(activities).all().length).toBe(0);
		expect(getDb().select().from(activityFiles).all().length).toBe(0);
		// Parse-before-write: no original may exist on disk.
		const original = path.join(dataDir, 'uploads', user.id, `${sha256Hex(bytes)}.fit`);
		await expect(fs.access(original)).rejects.toThrow();
	});

	it('tolerates an orphaned original from a prior crash (EEXIST)', async () => {
		const user = await registerUser('u@example.com');
		const bytes = new Uint8Array([4, 4, 4]);
		const dest = path.join(dataDir, 'uploads', user.id, `${sha256Hex(bytes)}.fit`);
		await fs.mkdir(path.dirname(dest), { recursive: true });
		await fs.writeFile(dest, bytes);

		const outcome = await ingestFitActivity({
			userId: user.id,
			bytes,
			filename: 'retry.fit',
			provenance: { source: 'upload' },
			originalDest: { kind: 'uploads' },
			titleMetadata: null
		});
		expect(outcome.kind).toBe('imported');
	});
});
