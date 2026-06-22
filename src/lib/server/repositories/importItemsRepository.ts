import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { importItems, type ImportItemStatus } from '$lib/server/db/schema';

export type DbImportItem = typeof importItems.$inferSelect;

export async function createImportItem(input: {
	id: string;
	batchId: string;
	userId: string;
	sourcePath: string;
	originalFilename: string;
	detectedFormat: string;
	fileSizeBytes: number;
	sha256: string;
	status: ImportItemStatus;
	activityId?: string | null;
	errorMessage?: string | null;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.insert(importItems)
		.values({
			id: input.id,
			batchId: input.batchId,
			userId: input.userId,
			sourcePath: input.sourcePath,
			originalFilename: input.originalFilename,
			detectedFormat: input.detectedFormat,
			fileSizeBytes: input.fileSizeBytes,
			sha256: input.sha256,
			status: input.status,
			activityId: input.activityId ?? null,
			errorMessage: input.errorMessage ?? null,
			createdAt: now,
			updatedAt: now
		})
		.run();
}

export async function updateImportItem(input: {
	id: string;
	batchId: string;
	userId: string;
	status?: ImportItemStatus;
	sha256?: string;
	activityId?: string | null;
	errorMessage?: string | null;
}): Promise<void> {
	const db = getDb();
	db.update(importItems)
		.set({
			status: input.status ?? undefined,
			sha256: input.sha256 ?? undefined,
			activityId: input.activityId ?? undefined,
			errorMessage: input.errorMessage ?? undefined,
			updatedAt: new Date()
		})
		.where(and(eq(importItems.id, input.id), eq(importItems.batchId, input.batchId), eq(importItems.userId, input.userId)))
		.run();
}

export async function listImportItemsForBatchUser(input: {
	batchId: string;
	userId: string;
	limit: number;
}): Promise<DbImportItem[]> {
	const db = getDb();
	return db
		.select()
		.from(importItems)
		.where(and(eq(importItems.batchId, input.batchId), eq(importItems.userId, input.userId)))
		.orderBy(asc(importItems.createdAt))
		.limit(input.limit)
		.all();
}

export async function listFailedImportItemsForBatchUser(input: {
	batchId: string;
	userId: string;
	limit: number;
}): Promise<DbImportItem[]> {
	const db = getDb();
	return db
		.select()
		.from(importItems)
		.where(and(eq(importItems.batchId, input.batchId), eq(importItems.userId, input.userId), eq(importItems.status, 'failed')))
		.orderBy(desc(importItems.createdAt))
		.limit(input.limit)
		.all();
}

export async function listProblemImportItemsForBatchUser(input: {
	batchId: string;
	userId: string;
	limit: number;
}): Promise<DbImportItem[]> {
	const db = getDb();
	return db
		.select()
		.from(importItems)
		.where(
			and(
				eq(importItems.batchId, input.batchId),
				eq(importItems.userId, input.userId),
				inArray(importItems.status, ['failed', 'unsupported'])
			)
		)
		.orderBy(desc(importItems.createdAt))
		.limit(input.limit)
		.all();
}
