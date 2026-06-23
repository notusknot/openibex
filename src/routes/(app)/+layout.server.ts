import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getRailSummary } from '$lib/server/services/appShellService';
import { maybeTriggerAutoSync } from '$lib/server/services/sync/syncService';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	// Experimental Garmin sync: opportunistically pull new activities on app
	// navigation. Fire-and-forget + throttled, so it never delays this load.
	void maybeTriggerAutoSync(locals.user.id);
	const railSummary = await getRailSummary(locals.user.id, { prefs: locals.userPrefs });
	return {
		user: locals.user,
		userPrefs: locals.userPrefs,
		railSummary
	};
};
