import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

import { sports } from '$lib/server/db/schema';
import { createPlannedWorkoutForUser } from '$lib/server/services/plannedWorkoutsService';
import { isLocalDate, formatLocalDate } from '$lib/validation/localDate';
import { parsePlannedWorkoutForm } from '$lib/validation/plannedWorkout';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');
	const date = url.searchParams.get('date') ?? '';
	const initialDate = isLocalDate(date) ? date : formatLocalDate(new Date());
	return { sports, initialDate };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const parsed = parsePlannedWorkoutForm(form);
		if (!parsed.ok) return fail(400, { error: parsed.message });

		const created = await createPlannedWorkoutForUser({
			userId: locals.user.id,
			...parsed.value
		});

		const month = parsed.value.scheduledDate.slice(0, 7);
		throw redirect(303, `/calendar?month=${month}`);
	}
};

