import crypto from 'node:crypto';

import { FitNotAnActivityError, parseFit } from '$lib/server/parsers/fit/fitParser';
import {
	commitActivityWithFile,
	getActivityByFingerprintForUser,
	getActivityBySourceActivityIdForUser,
	getActivityBySourceFileShaForUser
} from '$lib/server/repositories/activitiesRepository';
import { getActivityFileByShaForUser } from '$lib/server/repositories/activityFilesRepository';
import {
	gzipJson,
	importOriginalRelativePath,
	uploadRelativePath,
	writeImportOriginal,
	writeStreamBlob,
	writeUploadFile
} from '$lib/server/services/fileStorageService';
import {
	computeActivityStreamMetrics,
	serializeStreamMetrics
} from '$lib/server/services/analytics/streamAggregates';
import { composeSmartTitle } from '$lib/server/services/imports/titleStrategy';
import type { GarminMetadataLookup } from '$lib/server/services/imports/garminMetadata';

/**
 * The single per-file ingest pipeline behind all three ingestion paths
 * (single upload, live Garmin sync, offline bulk import). This module is the
 * authoritative home of the 3-layer dedup guarantee documented in
 * docs/DOMAIN.md — callers keep their own loops, bookkeeping (import batches /
 * items), cursors, and locks, but never re-implement dedup, parsing, or
 * storage.
 *
 * Canonical order: source-id → sha-256 → parse → fingerprint → store → commit.
 * Parsing happens BEFORE any disk write, so a parse failure is fully
 * retryable and leaves no orphaned files.
 */

export type IngestSource = 'garmin-sync' | 'garmin-export' | 'upload';

export type IngestInput = {
	userId: string;
	bytes: Uint8Array;
	filename: string;
	provenance: {
		source: IngestSource;
		/** Garmin activity id, when the source supplies one (sync always, bulk best-effort, upload never). */
		sourceActivityId?: string | null;
	};
	/** Where the original FIT bytes land on disk. */
	originalDest: { kind: 'uploads' } | { kind: 'import-batch'; batchId: string };
	/** Garmin-export metadata for smart titles; null for sync and upload. */
	titleMetadata: GarminMetadataLookup | null;
};

/** Duplicate and unsupported are expected outcomes, not errors — only genuine
 * failures (parse deadline, disk, DB) throw. */
export type IngestOutcome =
	| { kind: 'imported'; activityId: string; activityFileId: string; sha256: string }
	| {
			kind: 'duplicate';
			layer: 'source-id' | 'sha256' | 'fingerprint';
			activityId: string | null;
			activityFileId: string | null;
			sha256: string;
	  }
	| { kind: 'unsupported'; reason: string; sha256: string };

function sha256Hex(bytes: Uint8Array): string {
	return crypto.createHash('sha256').update(bytes).digest('hex');
}

export async function ingestFitActivity(input: IngestInput): Promise<IngestOutcome> {
	const sha256 = sha256Hex(input.bytes);

	// Dedup layer 1: source activity id. Deliberately matched across sources:
	// garmin-sync and garmin-export share Garmin's activity-id space, so an
	// activity imported via one path must dedupe against the other.
	const sourceActivityId = input.provenance.sourceActivityId ?? null;
	if (sourceActivityId) {
		const bySourceId = await getActivityBySourceActivityIdForUser({
			userId: input.userId,
			sourceActivityId
		});
		if (bySourceId) {
			return {
				kind: 'duplicate',
				layer: 'source-id',
				activityId: bySourceId.id,
				activityFileId: bySourceId.activityFileId,
				sha256
			};
		}
	}

	// Dedup layer 2: exact FIT bytes, in both places a sha can live — on the
	// activity (sourceFileSha256) and on any stored activity_file.
	const bySha = await getActivityBySourceFileShaForUser({ userId: input.userId, sha256 });
	if (bySha) {
		return {
			kind: 'duplicate',
			layer: 'sha256',
			activityId: bySha.id,
			activityFileId: bySha.activityFileId,
			sha256
		};
	}
	const fileBySha = await getActivityFileByShaForUser(sha256, input.userId);
	if (fileBySha) {
		return { kind: 'duplicate', layer: 'sha256', activityId: null, activityFileId: fileBySha.id, sha256 };
	}

	// Parse before any disk write: a parse failure throws before anything
	// touches disk (fully retryable, no orphan), and the summary feeds the
	// fingerprint dedup below. A sessionless FIT (device settings, course,
	// monitoring…) is an expected outcome, not an error.
	let parsed;
	try {
		parsed = await parseFit(input.bytes, input.filename);
	} catch (err) {
		if (err instanceof FitNotAnActivityError) {
			return { kind: 'unsupported', reason: err.message, sha256 };
		}
		throw err;
	}

	parsed.summary.title = composeSmartTitle({
		metadataLookup: input.titleMetadata,
		sport: parsed.summary.sport,
		startTime: parsed.summary.startTime
	});

	// Dedup layer 3: fingerprint — the same activity arriving as byte-different
	// FIT (a Garmin re-encode) must not double-count its load into the PMC.
	const byFingerprint = await getActivityByFingerprintForUser({
		userId: input.userId,
		sport: parsed.summary.sport,
		startTime: parsed.summary.startTime,
		durationSec: parsed.summary.durationSec ?? null,
		distanceM: parsed.summary.distanceM ?? null
	});
	if (byFingerprint) {
		return {
			kind: 'duplicate',
			layer: 'fingerprint',
			activityId: byFingerprint.id,
			activityFileId: byFingerprint.activityFileId,
			sha256
		};
	}

	// Store the original FIT. EEXIST is tolerated: dedup is by sha, so a
	// leftover file from a prior crash is byte-identical and harmless.
	let stored: { relativePath: string; sizeBytes: number };
	try {
		stored =
			input.originalDest.kind === 'uploads'
				? await writeUploadFile({ userId: input.userId, sha256, ext: 'fit', bytes: input.bytes })
				: await writeImportOriginal({
						batchId: input.originalDest.batchId,
						sha256,
						ext: 'fit',
						bytes: input.bytes
					});
	} catch (e) {
		if ((e as NodeJS.ErrnoException)?.code !== 'EEXIST') throw e;
		stored = {
			relativePath:
				input.originalDest.kind === 'uploads'
					? uploadRelativePath(input.userId, sha256, 'fit')
					: importOriginalRelativePath(input.originalDest.batchId, sha256, 'fit'),
			sizeBytes: input.bytes.byteLength
		};
	}

	const activityFileId = crypto.randomUUID();
	const activityId = crypto.randomUUID();
	const gzipBytes = await gzipJson(parsed.stream);
	const stream = await writeStreamBlob({ activityId, gzipBytes });
	const metrics = serializeStreamMetrics(computeActivityStreamMetrics(parsed.stream));
	const now = new Date();

	// Atomic: the activity_file + activity (+ metrics) rows commit together, so
	// a crash mid-write can't leave an orphan file row. The FIT original and
	// the stream blob were already written to disk above, outside the
	// transaction (better-sqlite3 transactions are synchronous).
	commitActivityWithFile({
		file: {
			id: activityFileId,
			userId: input.userId,
			originalFilename: input.filename,
			filePath: stored.relativePath,
			fileType: 'fit',
			sha256,
			sizeBytes: stored.sizeBytes,
			uploadedAt: now
		},
		activity: {
			id: activityId,
			userId: input.userId,
			activityFileId,
			source: input.provenance.source,
			sourceActivityId,
			sourceFileSha256: sha256,
			sourceFilename: input.filename,
			importedAt: now,
			sport: parsed.summary.sport,
			title: parsed.summary.title,
			startTime: parsed.summary.startTime,
			durationSec: parsed.summary.durationSec,
			movingTimeSec: parsed.summary.movingTimeSec,
			distanceM: parsed.summary.distanceM,
			elevationGainM: parsed.summary.elevationGainM,
			avgHr: parsed.summary.avgHr,
			maxHr: parsed.summary.maxHr,
			avgPowerW: parsed.summary.avgPowerW,
			maxPowerW: parsed.summary.maxPowerW,
			avgCadence: parsed.summary.avgCadence,
			calories: parsed.summary.calories,
			streamPath: stream.relativePath,
			parserVersion: parsed.parserVersion
		},
		metrics
	});

	return { kind: 'imported', activityId, activityFileId, sha256 };
}
