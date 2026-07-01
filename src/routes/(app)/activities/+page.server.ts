import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { getActivitiesList } from '$lib/server/services/activitiesListService';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	// Stream the full set (searched/filtered/paginated client-side): return the
	// promise unawaited so the page shell transitions instantly over the relay and
	// the rows fill in via {#await}, instead of the nav blocking on a round trip.
	const activities = getActivitiesList({
		userId: locals.user.id,
		prefs: locals.userPrefs
	});
	// Ship the unit preference once (not per row) so the client can format
	// distances from raw meters. Stays sync — it's needed for first paint.
	const units = locals.userPrefs?.units ?? 'imperial';
	return { activities, units };
};
