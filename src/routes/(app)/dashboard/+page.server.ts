import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDashboardData } from '$lib/server/services/dashboardService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	const dashboard = await getDashboardData(locals.user.id, { prefs: locals.userPrefs });
	// Ship the unit preference once so the client can format recent-activity
	// distances from raw meters (the rows themselves carry no display labels).
	const units = locals.userPrefs?.units ?? 'imperial';
	return { dashboard, units };
};
