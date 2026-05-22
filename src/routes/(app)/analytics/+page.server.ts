import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { sports, type Sport } from '$lib/server/db/schema';
import { getWeeklyAnalytics, getFitnessSeries } from '$lib/server/services/analytics/analyticsService';
import { formatLocalDate } from '$lib/validation/localDate';
import { parseSport } from '$lib/validation/plannedWorkout';
import { weekStartIsoMonday } from '$lib/server/services/analytics/time';

function addDays(d: Date, days: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + days);
	return x;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');

	const weeksRaw = url.searchParams.get('weeks') ?? '12';
	const weeks = Math.min(52, Math.max(4, Number(weeksRaw) || 12));

	const sportParam = url.searchParams.get('sport') ?? '';
	const sport = sportParam ? (parseSport(sportParam) as Sport | null) : null;

	const today = new Date();
	const endDate = formatLocalDate(today);
	const startAnchor = addDays(today, -7 * (weeks - 1));
	const fromDate = weekStartIsoMonday(startAnchor);
	const toDate = endDate;

	const [weekly, fitness] = await Promise.all([
		getWeeklyAnalytics({ userId: locals.user.id, fromDate, toDate, sport: sport ?? undefined }),
		getFitnessSeries({ userId: locals.user.id, fromDate, toDate })
	]);

	const totals = weekly.reduce(
		(acc, w) => {
			acc.completedDuration += w.completed.durationSec;
			acc.completedDistance += w.completed.distanceM;
			acc.completedElevation += w.completed.elevationM;
			acc.completedLoad += w.completed.load;
			acc.plannedDuration += w.planned.durationSec;
			acc.plannedDistance += w.planned.distanceM;
			acc.plannedLoad += w.planned.load;
			return acc;
		},
		{
			completedDuration: 0,
			completedDistance: 0,
			completedElevation: 0,
			completedLoad: 0,
			plannedDuration: 0,
			plannedDistance: 0,
			plannedLoad: 0
		}
	);

	return { weeks, fromDate, toDate, sports, sport, weekly, fitness, totals };
};

