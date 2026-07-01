import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { getActivitiesList } from '$lib/server/services/activitiesListService';
import { getActivityComparison } from '$lib/server/services/compareService';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');

	const idA = url.searchParams.get('a');
	const idB = url.searchParams.get('b');

	// The full list feeds the two pickers (matches the /activities page); the
	// comparison is only computed once both sides are chosen.
	const [list, comparison] = await Promise.all([
		getActivitiesList({ userId: locals.user.id, prefs: locals.userPrefs }),
		idA && idB
			? getActivityComparison({ userId: locals.user.id, idA, idB, prefs: locals.userPrefs })
			: Promise.resolve(null)
	]);

	return { list, comparison, idA, idB, units: locals.userPrefs?.units ?? 'imperial' };
};
