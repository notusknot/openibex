import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { authenticateApiRequest, clampQueryInt } from '$lib/server/api/auth';
import { listPlannedWorkouts } from '$lib/server/services/plannedWorkoutsService';
import { localDayKey } from '$lib/server/time';

// GET /api/v1/planned?days=N — upcoming planned workouts from today forward
// (default horizon 14 days, max 90). Day keys use the app timezone.
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = await authenticateApiRequest(request);
	if (auth instanceof Response) return auth;

	const days = clampQueryInt(url.searchParams.get('days'), 14, 1, 90);
	const now = new Date();
	const fromDate = localDayKey(now);
	const toDate = localDayKey(new Date(now.getTime() + days * 86_400_000));
	const planned = await listPlannedWorkouts({ userId: auth.user.id, fromDate, toDate });
	return json({
		planned: planned.map((p) => ({
			id: p.id,
			sport: p.sport,
			scheduledDate: p.scheduledDate,
			title: p.title,
			plannedDurationSec: p.plannedDurationSec,
			plannedDistanceM: p.plannedDistanceM,
			plannedLoad: p.plannedLoad
		}))
	});
};
