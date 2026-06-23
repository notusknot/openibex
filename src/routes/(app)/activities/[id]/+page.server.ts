import type { Actions, PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

import { getActivityDetail, deleteActivity } from '$lib/server/services/activityDetailService';
import { deleteWorkoutLinksForActivity } from '$lib/server/repositories/workoutLinksRepository';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const detail = await getActivityDetail({
		userId: locals.user.id,
		activityId: params.id,
		prefs: locals.userPrefs
	});
	if (!detail) throw error(404, 'Not found');

	return { detail };
};

export const actions: Actions = {
	unlink: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		await deleteWorkoutLinksForActivity(locals.user.id, params.id);
		return { success: true };
	},
	delete: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const deleted = await deleteActivity({ userId: locals.user.id, activityId: params.id });
		if (!deleted) throw error(404, 'Not found');
		throw redirect(303, '/activities');
	}
};
