import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

import { sports, type Sport } from '$lib/server/db/schema';
import { listPlannedWorkouts } from '$lib/server/services/plannedWorkoutsService';
import { monthEndDate, monthStartDate, parseMonthParam } from '$lib/validation/localDate';
import { parseSport } from '$lib/validation/plannedWorkout';

type CalendarDay = {
	date: string;
	dayOfMonth: number;
	workouts: Array<{ id: string; title: string; sport: Sport }>;
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

	const workouts = await listPlannedWorkouts({
		userId: locals.user.id,
		fromDate,
		toDate,
		sport: sport ?? undefined
	});

	const byDate = new Map<string, CalendarDay['workouts']>();
	for (const w of workouts) {
		const list = byDate.get(w.scheduledDate) ?? [];
		list.push({ id: w.id, title: w.title, sport: w.sport });
		byDate.set(w.scheduledDate, list);
	}

	const daysInMonth = new Date(year, month, 0).getDate();
	const days: CalendarDay[] = [];
	for (let d = 1; d <= daysInMonth; d++) {
		const date = `${String(year)}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		days.push({
			date,
			dayOfMonth: d,
			workouts: byDate.get(date) ?? []
		});
	}

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
		cells
	};
};
