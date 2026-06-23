import { json } from '@sveltejs/kit';
import { getHealth } from '$lib/server/services/healthService';

export async function GET() {
	try {
		return json(await getHealth());
	} catch {
		// DB unreachable → report unhealthy (503) so Docker/orchestration can act.
		return json({ ok: false, db: 'down' }, { status: 503 });
	}
}
