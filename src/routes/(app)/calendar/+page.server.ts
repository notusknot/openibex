import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

import { getCalendarMonth } from '$lib/server/services/calendarMonthService';
import { createPlannedWorkoutForUser } from '$lib/server/services/plannedWorkoutsService';
import { parseMonthParam } from '$lib/validation/localDate';
import { parsePlannedWorkoutForm } from '$lib/validation/plannedWorkout';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');

	const monthParam = url.searchParams.get('month');
	const parsed = monthParam ? parseMonthParam(monthParam) : { ok: false as const };
	const now = new Date();
	const year = parsed.ok ? parsed.year : now.getFullYear();
	const month = parsed.ok ? parsed.month : now.getMonth() + 1;

	const calendar = await getCalendarMonth({
		userId: locals.user.id,
		year,
		month,
		now,
		prefs: locals.userPrefs
	});

	return { calendar };
};

const MONTH_RE = /^\d{4}-\d{2}$/;

export const actions: Actions = {
	createPlanned: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();

		const monthParam = String(form.get('month') ?? '').trim();
		if (!MONTH_RE.test(monthParam)) {
			return fail(400, { error: 'Invalid month.' });
		}
		const dayRaw = String(form.get('day') ?? '').trim();
		const day = Number(dayRaw);
		if (!Number.isFinite(day) || day < 1 || day > 31) {
			return fail(400, { error: 'Pick a day between 1 and 31.' });
		}
		const scheduledDate = `${monthParam}-${String(day).padStart(2, '0')}`;
		// Verify the date actually exists in that month (e.g. reject day=31 in Feb).
		const [yearStr, monthStr] = monthParam.split('-');
		const year = Number(yearStr);
		const monthN = Number(monthStr);
		const daysInMonth = new Date(year, monthN, 0).getDate();
		if (day > daysInMonth) {
			return fail(400, { error: `${monthParam} only has ${daysInMonth} days.` });
		}

		// Reshape modal fields into the schema the shared helper expects.
		form.set('scheduledDate', scheduledDate);
		const tss = form.get('tss');
		if (tss !== null) form.set('plannedLoad', String(tss));

		const parsedForm = parsePlannedWorkoutForm(form);
		if (!parsedForm.ok) return fail(400, { error: parsedForm.message });

		await createPlannedWorkoutForUser({
			userId: locals.user.id,
			...parsedForm.value
		});

		throw redirect(303, `/calendar?month=${monthParam}`);
	}
};
