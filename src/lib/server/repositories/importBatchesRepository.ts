import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { importBatches, type ImportBatchStatus } from '$lib/server/db/schema';

export type DbImportBatch = typeof importBatches.$inferSelect;

export async function createImportBatch(input: {
	id: string;
	userId: string;
	source: string;
	originalName: string;
	status: ImportBatchStatus;
	startedAt?: Date | null;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.insert(importBatches)
		.values({
			id: input.id,
			userId: input.userId,
			source: input.source,
			originalName: input.originalName,
			status: input.status,
			startedAt: input.startedAt ?? null,
			createdAt: now,
			updatedAt: now
		})
		.run();
}

export async function getImportBatchForUser(id: string, userId: string): Promise<DbImportBatch | undefined> {
	const db = getDb();
	return db
		.select()
		.from(importBatches)
		.where(and(eq(importBatches.id, id), eq(importBatches.userId, userId)))
		.get();
}

export async function listImportBatchesForUser(userId: string, limit: number): Promise<DbImportBatch[]> {
	const db = getDb();
	return db
		.select()
		.from(importBatches)
		.where(eq(importBatches.userId, userId))
		.orderBy(desc(importBatches.createdAt))
		.limit(limit)
		.all();
}

export async function updateImportBatchProgress(input: {
	id: string;
	userId: string;
	status?: ImportBatchStatus;
	totalFiles?: number;
	processedFiles?: number;
	importedCount?: number;
	duplicateCount?: number;
	failedCount?: number;
	completedAt?: Date | null;
}): Promise<void> {
	const db = getDb();
	db.update(importBatches)
		.set({
			status: input.status ?? undefined,
			totalFiles: input.totalFiles ?? undefined,
			processedFiles: input.processedFiles ?? undefined,
			importedCount: input.importedCount ?? undefined,
			duplicateCount: input.duplicateCount ?? undefined,
			failedCount: input.failedCount ?? undefined,
			completedAt: input.completedAt ?? undefined,
			updatedAt: new Date()
		})
		.where(and(eq(importBatches.id, input.id), eq(importBatches.userId, input.userId)))
		.run();
}

