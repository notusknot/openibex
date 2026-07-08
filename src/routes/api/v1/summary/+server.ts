import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { authenticateApiRequest } from '$lib/server/api/auth';
import { getDashboardData } from '$lib/server/services/dashboardService';

// GET /api/v1/summary — current training-load snapshot (the dashboard KPIs).
export const GET: RequestHandler = async ({ request }) => {
	const auth = await authenticateApiRequest(request);
	if (auth instanceof Response) return auth;

	const { kpis } = await getDashboardData(auth.user.id, { prefs: auth.prefs });
	return json({
		user: auth.user.email,
		generatedAt: new Date().toISOString(),
		fitness: kpis.fitness, // CTL
		fatigue: kpis.fatigue, // ATL
		form: kpis.formNum, // TSB
		weekTss: kpis.weekTss,
		ramp: kpis.ramp,
		readiness: { value: kpis.readinessVal, label: kpis.readinessLabel },
		monotony: kpis.monotony,
		strain: kpis.strain
	});
};
