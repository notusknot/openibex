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
import {
	applyCoachVersion as applyCoachVersionWrite,
	getSyncedWorkoutForPlannedWorkout,
	keepUserVersion as keepUserVersionWrite
} from '$lib/server/repositories/calendarSyncedWorkoutsRepository';
import { hashWorkoutFields, type MappedWorkout } from '$lib/server/services/sync/calendarMapping';
import { setManualLink } from '$lib/server/services/workoutMatchingService';
import { parsePlannedWorkoutForm } from '$lib/validation/plannedWorkout';

/** Parse the stashed upstream version of a conflicted synced workout. */
function readConflictFields(json: string | null): MappedWorkout | null {
	if (!json) return null;
	try {
		return JSON.parse(json) as MappedWorkout;
	} catch {
		return null;
	}
}

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

	// Calendar-sync provenance: is this workout synced from an ICS feed, and does
	// it have a pending conflict (coach changed a workout the user customized)?
	const syncedRow = await getSyncedWorkoutForPlannedWorkout(workout.id, locals.user.id);
	const synced = syncedRow
		? {
				label: syncedRow.subscriptionLabel,
				state: syncedRow.link.state,
				removedUpstream: syncedRow.link.removedUpstream,
				conflict: syncedRow.link.state === 'conflict' ? readConflictFields(syncedRow.link.conflictJson) : null
			}
		: null;

	return {
		sports,
		workout,
		link,
		matchedActivity,
		candidates,
		synced,
		units: locals.userPrefs?.units ?? 'imperial'
	};
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
	},

	// Resolve a calendar-sync conflict by taking the coach's (upstream) version.
	applyCoachVersion: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const synced = await getSyncedWorkoutForPlannedWorkout(params.id, locals.user.id);
		const fields = synced?.link.state === 'conflict' ? readConflictFields(synced.link.conflictJson) : null;
		if (!synced || !fields) return fail(400, { error: 'There is no conflict to resolve.' });
		await applyCoachVersionWrite({
			linkId: synced.link.id,
			plannedWorkoutId: params.id,
			userId: locals.user.id,
			fields,
			syncedHash: hashWorkoutFields(fields)
		});
		return { success: true };
	},

	// Resolve a calendar-sync conflict by keeping the user's version (and accepting
	// the new upstream baseline so the same change won't re-flag).
	keepMine: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const synced = await getSyncedWorkoutForPlannedWorkout(params.id, locals.user.id);
		const fields = synced?.link.state === 'conflict' ? readConflictFields(synced.link.conflictJson) : null;
		if (!synced || !fields) return fail(400, { error: 'There is no conflict to resolve.' });
		await keepUserVersionWrite({
			linkId: synced.link.id,
			userId: locals.user.id,
			syncedHash: hashWorkoutFields(fields)
		});
		return { success: true };
	}
};
