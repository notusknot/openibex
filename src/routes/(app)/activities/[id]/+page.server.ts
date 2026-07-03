import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';

import {
	getActivityDetail,
	deleteActivity,
	saveActivityDebrief
} from '$lib/server/services/activityDetailService';
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
	debrief: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const rpeRaw = String(form.get('rpe') ?? '');
		const gradeRaw = String(form.get('grade') ?? '');
		const ok = await saveActivityDebrief({
			userId: locals.user.id,
			activityId: params.id,
			rpe: rpeRaw === '' ? null : Number(rpeRaw),
			grade: gradeRaw === '' ? null : gradeRaw,
			note: String(form.get('note') ?? '')
		});
		if (!ok) return fail(400, { debriefError: true });
		return { debriefSaved: true };
	},
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
