import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getDashboardData } from '$lib/server/services/dashboardService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	const dashboard = await getDashboardData(locals.user.id);
	return { dashboard };
};
