import type { Actions, PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

import { getActivityDetail, deleteActivity } from '$lib/server/services/activityDetailService';
import { unlinkActivity } from '$lib/server/services/workoutMatchingService';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	// Stream the (heavy) detail — full streams, laps, HR zones, peaks — so tapping
	// a row transitions to the page shell instantly instead of blocking on the
	// relay round trip. A missing id resolves to null and renders as an in-page
	// "not found" in the component (no SSR 404 status — this is an auth-gated
	// internal deep link, so that trade is fine).
	const detail = getActivityDetail({
		userId: locals.user.id,
		activityId: params.id,
		prefs: locals.userPrefs
	});

	return { detail };
};

export const actions: Actions = {
	unlink: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		await unlinkActivity(locals.user.id, params.id);
		return { success: true };
	},
	delete: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const deleted = await deleteActivity({ userId: locals.user.id, activityId: params.id });
		if (!deleted) throw error(404, 'Not found');
		throw redirect(303, '/activities');
	}
};
