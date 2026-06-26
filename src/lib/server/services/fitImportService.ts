import crypto from 'node:crypto';
import zlib from 'node:zlib';

import { commitActivityWithFile } from '$lib/server/repositories/activitiesRepository';
import { getActivityFileByShaForUser } from '$lib/server/repositories/activityFilesRepository';
import { createImportJob } from '$lib/server/repositories/importJobsRepository';
import { parseFit } from '$lib/server/parsers/fit/fitParser';
import { writeStreamBlob, writeUploadFile } from '$lib/server/services/fileStorageService';
import { composeSmartTitle } from '$lib/server/services/imports/titleStrategy';
import {
	computeActivityStreamMetrics,
	serializeStreamMetrics
} from '$lib/server/services/analytics/streamAggregates';

export class DuplicateUploadError extends Error {
	readonly existingActivityFileId: string;
	constructor(existingActivityFileId: string) {
		super('Duplicate upload detected.');
		this.existingActivityFileId = existingActivityFileId;
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

	const existing = await getActivityFileByShaForUser(sha256, input.userId);
	if (existing) {
		throw new DuplicateUploadError(existing.id);
	}

	const activityFileId = crypto.randomUUID();
	const importJobId = crypto.randomUUID();
	const activityId = crypto.randomUUID();

	// Filesystem writes happen first, OUTSIDE the DB transaction (better-sqlite3
	// transactions are synchronous and can't await). A crash here leaves only
	// orphaned blobs on disk, which dedup-by-sha makes harmless on retry; a parse
	// failure throws before any DB row exists, so the upload stays retryable
	// (previously a half-written activity_file row blocked re-uploading the file).
	const upload = await writeUploadFile({ userId: input.userId, sha256, ext: 'fit', bytes: input.bytes });

	const parsed = await parseFit(input.bytes, input.originalFilename);
	const gzipBytes = zlib.gzipSync(JSON.stringify(parsed.stream));
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

