import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { authenticateApiRequest } from '$lib/server/api/auth';
import { getDashboardData } from '$lib/server/services/dashboardService';
import { localDayKey } from '$lib/server/time';

// GET /api/v1/series — the 84-day PMC time-series (CTL/ATL/TSB) for charting.
export const GET: RequestHandler = async ({ request }) => {
	const auth = await authenticateApiRequest(request);
	if (auth instanceof Response) return auth;

	const { series } = await getDashboardData(auth.user.id, { prefs: auth.prefs });
	return json({
		series: series.map((p) => ({
			date: localDayKey(new Date(p.dateMs)),
			ctl: p.ctl,
			atl: p.atl,
			tsb: p.tsb
		}))
	});
};
