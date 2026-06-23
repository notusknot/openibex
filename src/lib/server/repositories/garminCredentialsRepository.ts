import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { garminCredentials, type GarminSyncStatus } from '$lib/server/db/schema';

export type DbGarminCredential = typeof garminCredentials.$inferSelect;

export async function getGarminCredentialForUser(userId: string): Promise<DbGarminCredential | undefined> {
	const db = getDb();
	return db.select().from(garminCredentials).where(eq(garminCredentials.userId, userId)).get();
}

// Connect / reconnect: store fresh session tokens. Resets sync status so a
// reconnect after an auth failure starts clean. One row per user (unique).
export async function saveGarminCredential(input: {
	id: string;
	userId: string;
	encryptedBlob: string;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.insert(garminCredentials)
		.values({
			id: input.id,
			userId: input.userId,
			encryptedBlob: input.encryptedBlob,
			syncEnabled: true,
			lastSyncStatus: null,
			lastSyncError: null,
			createdAt: now,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: garminCredentials.userId,
			set: {
				encryptedBlob: input.encryptedBlob,
				syncEnabled: true,
				lastSyncStatus: null,
				lastSyncError: null,
				updatedAt: now
			}
		})
		.run();
}

// Persist refreshed tokens mid-sync (e.g. after a token refresh) without
// touching sync status.
export async function updateGarminTokens(input: {
	userId: string;
	encryptedBlob: string;
}): Promise<void> {
	const db = getDb();
	db.update(garminCredentials)
		.set({ encryptedBlob: input.encryptedBlob, updatedAt: new Date() })
		.where(eq(garminCredentials.userId, input.userId))
		.run();
}

export async function updateGarminSyncStatus(input: {
	userId: string;
	lastSyncAt?: Date | null;
	lastSyncStatus?: GarminSyncStatus | null;
	lastSyncError?: string | null;
}): Promise<void> {
	const db = getDb();
	db.update(garminCredentials)
		.set({
			lastSyncAt: input.lastSyncAt ?? undefined,
			lastSyncStatus: input.lastSyncStatus ?? undefined,
			lastSyncError: input.lastSyncError === undefined ? undefined : input.lastSyncError,
			updatedAt: new Date()
		})
		.where(eq(garminCredentials.userId, input.userId))
		.run();
}

export async function deleteGarminCredentialForUser(userId: string): Promise<void> {
	const db = getDb();
	db.delete(garminCredentials).where(eq(garminCredentials.userId, userId)).run();
}
