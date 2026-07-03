import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { comments, type CommentTargetType } from '$lib/server/db/schema';

export type DbComment = typeof comments.$inferSelect;

// The debrief flow treats a target's comment as singular (one note per
// activity); the schema allows more if a future feature wants threads.
export async function getCommentForTarget(input: {
	userId: string;
	targetType: CommentTargetType;
	targetId: string;
}): Promise<DbComment | undefined> {
	return getDb()
		.select()
		.from(comments)
		.where(
			and(
				eq(comments.userId, input.userId),
				eq(comments.targetType, input.targetType),
				eq(comments.targetId, input.targetId)
			)
		)
		.get();
}

export async function upsertCommentForTarget(input: {
	userId: string;
	targetType: CommentTargetType;
	targetId: string;
	body: string;
}): Promise<void> {
	const db = getDb();
	const existing = await getCommentForTarget(input);
	if (existing) {
		db.update(comments)
			.set({ body: input.body, updatedAt: new Date() })
			.where(eq(comments.id, existing.id))
			.run();
	} else {
		db.insert(comments)
			.values({
				id: crypto.randomUUID(),
				userId: input.userId,
				targetType: input.targetType,
				targetId: input.targetId,
				body: input.body
			})
			.run();
	}
}

export async function deleteCommentForTarget(input: {
	userId: string;
	targetType: CommentTargetType;
	targetId: string;
}): Promise<void> {
	getDb()
		.delete(comments)
		.where(
			and(
				eq(comments.userId, input.userId),
				eq(comments.targetType, input.targetType),
				eq(comments.targetId, input.targetId)
			)
		)
		.run();
}
