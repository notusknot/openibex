import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';

import type { Sport } from '$lib/server/db/schema';
import { parseSport } from '$lib/validation/plannedWorkout';
import { getWeeklyAnalytics, getFitnessSeries } from '$lib/server/services/analytics/analyticsService';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');

	const fromDate = url.searchParams.get('from') ?? '';
	const toDate = url.searchParams.get('to') ?? '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
		return json({ error: 'from/to must be YYYY-MM-DD' }, { status: 400 });
	}

	const sportParam = url.searchParams.get('sport') ?? '';
	const sport = sportParam ? (parseSport(sportParam) as Sport | null) : null;

	const [weekly, fitness] = await Promise.all([
		getWeeklyAnalytics({ userId: locals.user.id, fromDate, toDate, sport: sport ?? undefined }),
		getFitnessSeries({ userId: locals.user.id, fromDate, toDate })
	]);

	return json({ fromDate, toDate, sport, weekly, fitness });
};

