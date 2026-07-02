import crypto from 'node:crypto';

import { createImportJob } from '$lib/server/repositories/importJobsRepository';
import { ingestFitActivity } from '$lib/server/services/ingestService';

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

export async function importFitUpload(input: {
	userId: string;
	originalFilename: string;
	bytes: Uint8Array;
}): Promise<{ activityId: string; activityFileId: string; importJobId: string }> {
	// The dedup + parse + store pipeline lives in ingestService (the shared
	// per-file ingest behind all three ingestion paths). This wrapper only maps
	// outcomes onto the upload route's contract and records the import job.
	const outcome = await ingestFitActivity({
		userId: input.userId,
		bytes: input.bytes,
		filename: input.originalFilename,
		provenance: { source: 'upload' },
		originalDest: { kind: 'uploads' },
		titleMetadata: null
	});

	if (outcome.kind === 'duplicate') {
		throw new DuplicateUploadError(outcome.activityFileId ?? '', outcome.activityId ?? undefined);
	}
	if (outcome.kind === 'unsupported') {
		throw new Error(outcome.reason);
	}

	// Job record for the import history (FK to activity_file is now satisfied).
	const importJobId = crypto.randomUUID();
	const now = new Date();
	await createImportJob({
		id: importJobId,
		userId: input.userId,
		activityFileId: outcome.activityFileId,
		status: 'succeeded',
		createdAt: now,
		updatedAt: now
	});

	return { activityId: outcome.activityId, activityFileId: outcome.activityFileId, importJobId };
}
