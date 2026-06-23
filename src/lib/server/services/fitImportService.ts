import crypto from 'node:crypto';
import zlib from 'node:zlib';

import { createActivity } from '$lib/server/repositories/activitiesRepository';
import { createActivityFile, getActivityFileByShaForUser } from '$lib/server/repositories/activityFilesRepository';
import { createImportJob, updateImportJobStatus } from '$lib/server/repositories/importJobsRepository';
import { parseFit } from '$lib/server/parsers/fit/fitParser';
import { writeStreamBlob, writeUploadFile } from '$lib/server/services/fileStorageService';
import { composeSmartTitle } from '$lib/server/services/imports/titleStrategy';

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

	const upload = await writeUploadFile({
		userId: input.userId,
		sha256,
		ext: 'fit',
		bytes: input.bytes
	});

	const now = new Date();
	await createActivityFile({
		id: activityFileId,
		userId: input.userId,
		originalFilename: input.originalFilename,
		filePath: upload.relativePath,
		fileType: 'fit',
		sha256,
		sizeBytes,
		uploadedAt: now
	});

	await createImportJob({
		id: importJobId,
		userId: input.userId,
		activityFileId,
		status: 'processing',
		createdAt: now,
		updatedAt: now
	});

	try {
		await updateImportJobStatus({
			id: importJobId,
			userId: input.userId,
			status: 'processing',
			startedAt: now
		});

		const parsed = await parseFit(input.bytes, input.originalFilename);
		const gzipBytes = zlib.gzipSync(JSON.stringify(parsed.stream));
		const stream = await writeStreamBlob({ activityId, gzipBytes });

		const title = composeSmartTitle({
			metadataLookup: null,
			sport: parsed.summary.sport,
			startTime: parsed.summary.startTime
		});

		await createActivity({
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
		});

		await updateImportJobStatus({
			id: importJobId,
			userId: input.userId,
			status: 'succeeded',
			completedAt: new Date()
		});

		return { activityId, activityFileId, importJobId };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Import failed.';
		await updateImportJobStatus({
			id: importJobId,
			userId: input.userId,
			status: 'failed',
			errorMessage: message,
			completedAt: new Date()
		});
		throw err;
	}
}

