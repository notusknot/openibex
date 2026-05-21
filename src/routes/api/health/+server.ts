import { json } from '@sveltejs/kit';
import { getHealth } from '$lib/server/services/healthService';

export async function GET() {
	const health = await getHealth();
	return json(health);
}
