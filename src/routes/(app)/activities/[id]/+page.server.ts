import type { Actions, PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

import { getActivityByIdForUser } from '$lib/server/repositories/activitiesRepository';
import { getActivityFileByIdForUser } from '$lib/server/repositories/activityFilesRepository';
import { getWorkoutLinkForActivity, deleteWorkoutLinksForActivity } from '$lib/server/repositories/workoutLinksRepository';
import { getPlannedWorkoutByIdForUser } from '$lib/server/repositories/plannedWorkoutsRepository';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const activity = await getActivityByIdForUser(params.id, locals.user.id);
	if (!activity) throw error(404, 'Not found');

	const file = activity.activityFileId
		? await getActivityFileByIdForUser(activity.activityFileId, locals.user.id)
		: null;

	const link = await getWorkoutLinkForActivity(locals.user.id, activity.id);
	const planned = link ? await getPlannedWorkoutByIdForUser(link.plannedWorkoutId, locals.user.id) : null;

	return { activity, file, link, planned };
};

export const actions: Actions = {
	unlink: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		await deleteWorkoutLinksForActivity(locals.user.id, params.id);
		return { success: true };
	}
};
