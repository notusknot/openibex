import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { activityFiles, type ActivityFileType } from '$lib/server/db/schema';

export type DbActivityFile = typeof activityFiles.$inferSelect;

export async function getActivityFileByIdForUser(id: string, userId: string): Promise<DbActivityFile | undefined> {
	const db = getDb();
	return db
		.select()
		.from(activityFiles)
		.where(and(eq(activityFiles.id, id), eq(activityFiles.userId, userId)))
		.get();
}

export async function getActivityFileByShaForUser(sha256: string, userId: string): Promise<DbActivityFile | undefined> {
	const db = getDb();
	return db
		.select()
		.from(activityFiles)
		.where(and(eq(activityFiles.userId, userId), eq(activityFiles.sha256, sha256)))
		.get();
}

export type CreateActivityFileInput = {
	id: string;
	userId: string;
	originalFilename: string;
	filePath: string;
	fileType: ActivityFileType;
	sha256: string;
	sizeBytes: number;
	uploadedAt: Date;
};

/** Build the insert row. Shared so the atomic import commit (commitActivityWithFile)
 * inserts the exact same shape inside a transaction. */
export function activityFileValues(input: CreateActivityFileInput) {
	return {
		id: input.id,
		userId: input.userId,
		originalFilename: input.originalFilename,
		filePath: input.filePath,
		fileType: input.fileType,
		sha256: input.sha256,
		sizeBytes: input.sizeBytes,
		uploadedAt: input.uploadedAt
	};
}

export async function createActivityFile(input: CreateActivityFileInput): Promise<void> {
	getDb().insert(activityFiles).values(activityFileValues(input)).run();
}

export async function deleteActivityFileForUser(input: { id: string; userId: string }): Promise<void> {
	const db = getDb();
	db.delete(activityFiles)
		.where(and(eq(activityFiles.id, input.id), eq(activityFiles.userId, input.userId)))
		.run();
}

