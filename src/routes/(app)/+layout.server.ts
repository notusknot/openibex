import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getRailSummary } from '$lib/server/services/appShellService';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	const railSummary = await getRailSummary(locals.user.id);
	return {
		user: locals.user,
		railSummary
	};
};
