import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { getActivitiesList } from '$lib/server/services/activitiesListService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	// Load the full set; the page searches/filters/paginates client-side.
	const data = await getActivitiesList({
		userId: locals.user.id,
		prefs: locals.userPrefs
	});
	// Ship the unit preference once (not per row) so the client can format
	// distances from raw meters.
	const units = locals.userPrefs?.units ?? 'imperial';
	return { activities: data, units };
};
