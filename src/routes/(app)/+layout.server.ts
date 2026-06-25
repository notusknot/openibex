import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getRailSummary } from '$lib/server/services/appShellService';
import { getSyncStatusForUser, maybeTriggerAutoSync } from '$lib/server/services/sync/syncService';
import { maybeTriggerCalendarSync } from '$lib/server/services/sync/calendarSyncService';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}
	// Experimental Garmin sync: opportunistically pull new activities on app
	// navigation. Fire-and-forget + throttled, so it never delays this load.
	void maybeTriggerAutoSync(locals.user.id);
	// Experimental calendar (ICS) sync: same opportunistic, per-subscription
	// throttled pattern — poll subscribed feeds on navigation, never blocking.
	void maybeTriggerCalendarSync(locals.user.id);
	const railSummary = await getRailSummary(locals.user.id, { prefs: locals.userPrefs });
	const garminSync = await getSyncStatusForUser(locals.user.id);
	return {
		user: locals.user,
		userPrefs: locals.userPrefs,
		railSummary,
		garminSync
	};
};
