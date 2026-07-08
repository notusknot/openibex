import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { authenticateApiRequest, clampQueryInt } from '$lib/server/api/auth';
import { getActivitiesList } from '$lib/server/services/activitiesListService';

// GET /api/v1/activities?limit=N — recent activities (default 20, max 100).
export const GET: RequestHandler = async ({ request, url }) => {
	const auth = await authenticateApiRequest(request);
	if (auth instanceof Response) return auth;

	const limit = clampQueryInt(url.searchParams.get('limit'), 20, 1, 100);
	const { rows, summary } = await getActivitiesList({
		userId: auth.user.id,
		limit,
		prefs: auth.prefs
	});
	return json({
		activities: rows.map((r) => ({
			id: r.id,
			sport: r.sport,
			title: r.title,
			startTime: new Date(r.startTimeMs).toISOString(),
			distanceM: r.distanceM,
			durationSec: r.durationSec,
			tss: r.tss,
			intensityFactor: r.intensityFactor,
			avgHr: r.avgHr
		})),
		summary
	});
};
