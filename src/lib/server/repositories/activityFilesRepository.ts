import { and, desc, eq } from 'drizzle-orm';
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

export async function createActivityFile(input: {
	id: string;
	userId: string;
	originalFilename: string;
	filePath: string;
	fileType: ActivityFileType;
	sha256: string;
	sizeBytes: number;
	uploadedAt: Date;
}): Promise<void> {
	const db = getDb();
	db.insert(activityFiles)
		.values({
			id: input.id,
			userId: input.userId,
			originalFilename: input.originalFilename,
			filePath: input.filePath,
			fileType: input.fileType,
			sha256: input.sha256,
			sizeBytes: input.sizeBytes,
			uploadedAt: input.uploadedAt
		})
		.run();
}

export async function listActivityFilesForUser(userId: string, limit: number): Promise<DbActivityFile[]> {
	const db = getDb();
	return db
		.select()
		.from(activityFiles)
		.where(eq(activityFiles.userId, userId))
		.orderBy(desc(activityFiles.uploadedAt))
		.limit(limit)
		.all();
}

