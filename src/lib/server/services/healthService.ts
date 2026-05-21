import { pingDatabase } from '$lib/server/repositories/healthRepository';

export async function getHealth(): Promise<{ ok: true }> {
	await pingDatabase();
	return { ok: true };
}
