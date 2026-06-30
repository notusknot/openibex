import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { importBatches, importItems, type ImportBatchStatus } from '$lib/server/db/schema';

export type DbImportBatch = typeof importBatches.$inferSelect;

/**
 * Boot-time recovery. A bulk import has no background worker — it rides the
 * request/process that started it — so a crash or `docker restart` mid-import
 * leaves the batch row stuck `processing` forever (and its items mid-flight).
 * Run once at startup: mark any non-terminal batch `failed` so the UI stops
 * showing a perpetual "processing", and fail its in-flight items. Returns the
 * number of batches swept. Idempotent.
 */
export function failOrphanedImportBatches(now: Date = new Date()): number {
	const db = getDb();
	return db.transaction((tx) => {
		const orphaned = tx
			.select({ id: importBatches.id })
			.from(importBatches)
			.where(inArray(importBatches.status, ['pending', 'processing']))
			.all();
		if (orphaned.length === 0) return 0;
		const ids = orphaned.map((b) => b.id);
		tx.update(importBatches)
			.set({ status: 'failed', completedAt: now, updatedAt: now })
			.where(inArray(importBatches.id, ids))
			.run();
		tx.update(importItems)
			.set({ status: 'failed', errorMessage: 'Interrupted by a server restart.', updatedAt: now })
			.where(and(inArray(importItems.batchId, ids), inArray(importItems.status, ['discovered', 'processing'])))
			.run();
		return orphaned.length;
	});
}

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

