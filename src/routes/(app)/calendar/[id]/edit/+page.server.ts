import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';

import { sports } from '$lib/server/db/schema';
import {
	deletePlannedWorkoutForUserService,
	getPlannedWorkoutForEdit,
	updatePlannedWorkoutForUserService
} from '$lib/server/services/plannedWorkoutsService';
import { deleteWorkoutLinkForPlannedWorkout, getWorkoutLinkForPlannedWorkout } from '$lib/server/repositories/workoutLinksRepository';
import { getActivityByIdForUser, listActivitiesForUserOnDateAndSport } from '$lib/server/repositories/activitiesRepository';
import { setManualLink } from '$lib/server/services/workoutMatchingService';
import { parsePlannedWorkoutForm } from '$lib/validation/plannedWorkout';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const workout = await getPlannedWorkoutForEdit({ userId: locals.user.id, id: params.id });
	if (!workout) throw error(404, 'Not found');

	const link = await getWorkoutLinkForPlannedWorkout(locals.user.id, workout.id);
	const matchedActivity = link ? await getActivityByIdForUser(link.activityId, locals.user.id) : null;
	const candidates = await listActivitiesForUserOnDateAndSport({
		userId: locals.user.id,
		date: workout.scheduledDate,
		sport: workout.sport
	});

	return { sports, workout, link, matchedActivity, candidates };
};

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const parsed = parsePlannedWorkoutForm(form);
		if (!parsed.ok) return fail(400, { error: parsed.message });

		try {
			await updatePlannedWorkoutForUserService({
				userId: locals.user.id,
				id: params.id,
				...parsed.value
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Update failed.';
			return fail(400, { error: message });
		}

		return { success: true };
	},
	delete: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		await deletePlannedWorkoutForUserService({ userId: locals.user.id, id: params.id });
		throw redirect(303, '/calendar');
	},
	unlink: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		await deleteWorkoutLinkForPlannedWorkout(locals.user.id, params.id);
		return { success: true };
	},
	link: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const activityId = String(form.get('activityId') ?? '').trim();
		if (!activityId) return fail(400, { error: 'Activity is required.' });
		try {
			await setManualLink({ userId: locals.user.id, plannedWorkoutId: params.id, activityId });
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Link failed.';
			return fail(400, { error: message });
		}
		return { success: true };
	}
};
