import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { importJobs, type ImportJobStatus } from '$lib/server/db/schema';

export type DbImportJob = typeof importJobs.$inferSelect;

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

export async function updateImportJobStatus(input: {
	id: string;
	userId: string;
	status: ImportJobStatus;
	errorMessage?: string | null;
	startedAt?: Date | null;
	completedAt?: Date | null;
}): Promise<void> {
	const db = getDb();
	db.update(importJobs)
		.set({
			status: input.status,
			errorMessage: input.errorMessage ?? null,
			startedAt: input.startedAt ?? null,
			completedAt: input.completedAt ?? null,
			updatedAt: new Date()
		})
		.where(and(eq(importJobs.id, input.id), eq(importJobs.userId, input.userId)))
		.run();
}

export async function listRecentImportJobsForUser(userId: string, limit: number): Promise<DbImportJob[]> {
	const db = getDb();
	return db
		.select()
		.from(importJobs)
		.where(eq(importJobs.userId, userId))
		.orderBy(desc(importJobs.createdAt))
		.limit(limit)
		.all();
}

