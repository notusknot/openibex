import crypto from 'node:crypto';

import {
	commitActivityWithFile,
	getActivityByFingerprintForUser
} from '$lib/server/repositories/activitiesRepository';
import { getActivityFileByShaForUser } from '$lib/server/repositories/activityFilesRepository';
import { createImportJob } from '$lib/server/repositories/importJobsRepository';
import { parseFit } from '$lib/server/parsers/fit/fitParser';
import { gzipJson, writeStreamBlob, writeUploadFile } from '$lib/server/services/fileStorageService';
import { composeSmartTitle } from '$lib/server/services/imports/titleStrategy';
import {
	computeActivityStreamMetrics,
	serializeStreamMetrics
} from '$lib/server/services/analytics/streamAggregates';

export class DuplicateUploadError extends Error {
	readonly existingActivityFileId: string;
	/** Set when the match was by parsed fingerprint rather than file SHA. */
	readonly existingActivityId?: string;
	constructor(existingActivityFileId: string, existingActivityId?: string) {
		super('Duplicate upload detected.');
		this.existingActivityFileId = existingActivityFileId;
		this.existingActivityId = existingActivityId;
	}
}

function sha256Hex(bytes: Uint8Array): string {
	return crypto.createHash('sha256').update(bytes).digest('hex');
}

export async function importFitUpload(input: {
	userId: string;
	originalFilename: string;
	bytes: Uint8Array;
}): Promise<{ activityId: string; activityFileId: string; importJobId: string }> {
	const sha256 = sha256Hex(input.bytes);
	const sizeBytes = input.bytes.byteLength;

	// Dedup 1: exact file SHA (a byte-identical re-upload).
	const existing = await getActivityFileByShaForUser(sha256, input.userId);
	if (existing) {
		throw new DuplicateUploadError(existing.id);
	}

	const activityFileId = crypto.randomUUID();
	const importJobId = crypto.randomUUID();
	const activityId = crypto.randomUUID();

	// Parse BEFORE any filesystem write: a parse failure then throws before
	// anything touches disk (fully retryable, no orphan), and we have the summary
	// needed for the fingerprint dedup below.
	const parsed = await parseFit(input.bytes, input.originalFilename);

	// Dedup 2: parsed fingerprint (sport + start + duration + distance). The bulk
	// and sync ingestion paths both apply this layer; without it the SAME ride
	// re-exported as byte-different FIT (a Garmin re-encode) would create a
	// duplicate activity here, double-counting its load into the PMC. DOMAIN.md
	// guarantees dedup on all three ingestion paths.
	const existingByFingerprint = await getActivityByFingerprintForUser({
		userId: input.userId,
		sport: parsed.summary.sport,
		startTime: parsed.summary.startTime,
		durationSec: parsed.summary.durationSec ?? null,
		distanceM: parsed.summary.distanceM ?? null
	});
	if (existingByFingerprint) {
		throw new DuplicateUploadError(existingByFingerprint.activityFileId ?? '', existingByFingerprint.id);
	}

	// Filesystem writes happen OUTSIDE the DB transaction (better-sqlite3
	// transactions are synchronous and can't await). A crash here leaves only
	// orphaned blobs on disk, which dedup-by-sha makes harmless on retry
	// (previously a half-written activity_file row blocked re-uploading the file).
	const upload = await writeUploadFile({ userId: input.userId, sha256, ext: 'fit', bytes: input.bytes });

	const gzipBytes = await gzipJson(parsed.stream);
	const stream = await writeStreamBlob({ activityId, gzipBytes });
	const metrics = serializeStreamMetrics(computeActivityStreamMetrics(parsed.stream));

	const title = composeSmartTitle({
		metadataLookup: null,
		sport: parsed.summary.sport,
		startTime: parsed.summary.startTime
	});
	const now = new Date();

	// Atomic: the activity_file and activity rows commit together or not at all.
	commitActivityWithFile({
		file: {
			id: activityFileId,
			userId: input.userId,
			originalFilename: input.originalFilename,
			filePath: upload.relativePath,
			fileType: 'fit',
			sha256,
			sizeBytes,
			uploadedAt: now
		},
		activity: {
			id: activityId,
			userId: input.userId,
			activityFileId,
			sport: parsed.summary.sport,
			title,
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

	// Job record for the import history (FK to activity_file is now satisfied).
	await createImportJob({
		id: importJobId,
		userId: input.userId,
		activityFileId,
		status: 'succeeded',
		createdAt: now,
		updatedAt: now
	});

	return { activityId, activityFileId, importJobId };
}

