import { getDb } from '$lib/server/db/client';

export async function pingDatabase(): Promise<void> {
	getDb();
}
