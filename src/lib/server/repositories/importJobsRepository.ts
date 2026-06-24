import { getDb } from '$lib/server/db/client';
import { importJobs, type ImportJobStatus } from '$lib/server/db/schema';

export async function createImportJob(input: {
	id: string;
	userId: string;
	activityFileId: string;
	status: ImportJobStatus;
	createdAt: Date;
	updatedAt: Date;
}): Promise<void> {
	const db = getDb();
	db.insert(importJobs)
		.values({
			id: input.id,
			userId: input.userId,
			activityFileId: input.activityFileId,
			status: input.status,
			createdAt: input.createdAt,
			updatedAt: input.updatedAt
		})
		.run();
}

