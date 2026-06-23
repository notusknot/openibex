import { eq, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { users, type Units, type UserRole, type WeekStart } from '$lib/server/db/schema';

export type DbUser = typeof users.$inferSelect;
export type DbUserInsert = typeof users.$inferInsert;

export async function countUsers(): Promise<number> {
	const db = getDb();
	const row = db.select({ count: sql<number>`count(*)` }).from(users).get();
	return row?.count ?? 0;
}

export async function getUserByEmail(email: string): Promise<DbUser | undefined> {
	const db = getDb();
	return db.select().from(users).where(eq(users.email, email)).get();
}

export async function getUserById(id: string): Promise<DbUser | undefined> {
	const db = getDb();
	return db.select().from(users).where(eq(users.id, id)).get();
}

export async function createUser(input: {
	id: string;
	email: string;
	passwordHash: string;
	displayName?: string | null;
	role: UserRole;
}): Promise<DbUser> {
	const db = getDb();
	const now = new Date();
	db.insert(users)
		.values({
			id: input.id,
			email: input.email,
			passwordHash: input.passwordHash,
			displayName: input.displayName ?? null,
			role: input.role,
			createdAt: now,
			updatedAt: now
		})
		.run();

	const created = await getUserById(input.id);
	if (!created) throw new Error('Failed to create user.');
	return created;
}

export async function updateDisplayName(userId: string, displayName: string | null): Promise<void> {
	const db = getDb();
	db.update(users)
		.set({ displayName, updatedAt: new Date() })
		.where(eq(users.id, userId))
		.run();
}

export type UserPreferenceUpdate = {
	ftpWatts?: number | null;
	thresholdHrBpm?: number | null;
	maxHrBpm?: number | null;
	thresholdPaceSecPerKm?: number | null;
	units?: Units;
	weekStart?: WeekStart;
};

export async function updateUserPreferences(
	userId: string,
	prefs: UserPreferenceUpdate
): Promise<void> {
	const db = getDb();
	const set: Record<string, unknown> = { updatedAt: new Date() };
	if ('ftpWatts' in prefs) set.ftpWatts = prefs.ftpWatts ?? null;
	if ('thresholdHrBpm' in prefs) set.thresholdHrBpm = prefs.thresholdHrBpm ?? null;
	if ('maxHrBpm' in prefs) set.maxHrBpm = prefs.maxHrBpm ?? null;
	if ('thresholdPaceSecPerKm' in prefs) set.thresholdPaceSecPerKm = prefs.thresholdPaceSecPerKm ?? null;
	if ('units' in prefs && prefs.units) set.units = prefs.units;
	if ('weekStart' in prefs && prefs.weekStart) set.weekStart = prefs.weekStart;
	db.update(users).set(set).where(eq(users.id, userId)).run();
}
