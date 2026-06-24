import { eq, lt } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { sessions } from '$lib/server/db/schema';

export type DbSession = typeof sessions.$inferSelect;

export async function createSession(input: {
	id: string;
	userId: string;
	sessionTokenHash: string;
	expiresAt: Date;
}): Promise<void> {
	const db = getDb();
	db.insert(sessions)
		.values({
			id: input.id,
			userId: input.userId,
			sessionTokenHash: input.sessionTokenHash,
			expiresAt: input.expiresAt,
			createdAt: new Date()
		})
		.run();
}

export async function getSessionByTokenHash(tokenHash: string): Promise<DbSession | undefined> {
	const db = getDb();
	return db.select().from(sessions).where(eq(sessions.sessionTokenHash, tokenHash)).get();
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
	const db = getDb();
	db.delete(sessions).where(eq(sessions.sessionTokenHash, tokenHash)).run();
}

export async function deleteExpiredSessions(now: Date): Promise<void> {
	const db = getDb();
	db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
}

