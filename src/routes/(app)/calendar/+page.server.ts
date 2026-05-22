import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { sports, type Sport } from '$lib/server/db/schema';
import { listPlannedWorkouts } from '$lib/server/services/plannedWorkoutsService';
import { monthEndDate, monthStartDate, parseMonthParam } from '$lib/validation/localDate';
import { parseSport } from '$lib/validation/plannedWorkout';
import { listActivitiesForUserInTimeRange } from '$lib/server/repositories/activitiesRepository';
import { ensureAutoMatchesForRange } from '$lib/server/services/workoutMatchingService';
import { listWorkoutLinksForPlannedWorkouts } from '$lib/server/repositories/workoutLinksRepository';

type CalendarDay = {
	date: string;
	dayOfMonth: number;
	planned: Array<{
		id: string;
		title: string;
		sport: Sport;
		match?: {
			activityId: string;
			matchType: string;
			durationCompliance: number | null;
			distanceCompliance: number | null;
			loadCompliance: number | null;
		};
	}>;
	completed: Array<{ id: string; title: string; sport: Sport }>;
};

type CalendarCell = { kind: 'empty' } | { kind: 'day'; day: CalendarDay };

function toMonthParam(year: number, month: number): string {
	return `${String(year)}-${String(month).padStart(2, '0')}`;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');

	const monthParam = url.searchParams.get('month');
	const parsed = monthParam ? parseMonthParam(monthParam) : { ok: false as const };
	const now = new Date();
	const year = parsed.ok ? parsed.year : now.getFullYear();
	const month = parsed.ok ? parsed.month : now.getMonth() + 1;

	const sportParam = url.searchParams.get('sport') ?? '';
	const sport = sportParam ? parseSport(sportParam) : null;

	const fromDate = monthStartDate(year, month);
	const toDate = monthEndDate(year, month);

	const planned = await listPlannedWorkouts({
		userId: locals.user.id,
		fromDate,
		toDate,
		sport: sport ?? undefined
	});

	const fromTs = new Date(`${fromDate}T00:00:00`);
	const toTs = new Date(`${toDate}T23:59:59.999`);
	const completedAll = await listActivitiesForUserInTimeRange({ userId: locals.user.id, from: fromTs, to: toTs });
	const completed = sport ? completedAll.filter((a) => a.sport === sport) : completedAll;

	await ensureAutoMatchesForRange({
		userId: locals.user.id,
		fromDate,
		toDate,
		sport: sport ?? undefined
	});

	const links = await listWorkoutLinksForPlannedWorkouts(
		locals.user.id,
		planned.map((p) => p.id)
	);
	const linkByPlanned = new Map(links.map((l) => [l.plannedWorkoutId, l]));

	const plannedByDate = new Map<string, CalendarDay['planned']>();
	for (const p of planned) {
		const list = plannedByDate.get(p.scheduledDate) ?? [];
		const link = linkByPlanned.get(p.id);
		list.push({
			id: p.id,
			title: p.title,
			sport: p.sport,
			match: link
				? {
						activityId: link.activityId,
						matchType: link.matchType,
						durationCompliance: link.durationCompliance ?? null,
						distanceCompliance: link.distanceCompliance ?? null,
						loadCompliance: link.loadCompliance ?? null
					}
				: undefined
		});
		plannedByDate.set(p.scheduledDate, list);
	}

	const completedByDate = new Map<string, CalendarDay['completed']>();
	for (const a of completed) {
		const d = new Date(a.startTime);
		const date = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		const list = completedByDate.get(date) ?? [];
		list.push({ id: a.id, title: a.title, sport: a.sport });
		completedByDate.set(date, list);
	}

	const daysInMonth = new Date(year, month, 0).getDate();
	const days: CalendarDay[] = [];
	for (let d = 1; d <= daysInMonth; d++) {
		const date = `${String(year)}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		days.push({
			date,
			dayOfMonth: d,
			planned: plannedByDate.get(date) ?? [],
			completed: completedByDate.get(date) ?? []
		});
	}

	const hasAny = planned.length > 0 || completed.length > 0;

	const firstDayJs = new Date(year, month - 1, 1).getDay(); // 0=Sun..6=Sat
	const firstDayMon0 = (firstDayJs + 6) % 7; // 0=Mon..6=Sun
	const cells: CalendarCell[] = [];
	for (let i = 0; i < firstDayMon0; i++) cells.push({ kind: 'empty' });
	for (const day of days) cells.push({ kind: 'day', day });

	const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
	const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

	return {
		month: { year, month, param: toMonthParam(year, month) },
		nav: {
			prev: toMonthParam(prevMonth.year, prevMonth.month),
			next: toMonthParam(nextMonth.year, nextMonth.month)
		},
		filter: {
			sport: sport ?? null
		},
		sports,
		cells,
		hasAny
	};
};
