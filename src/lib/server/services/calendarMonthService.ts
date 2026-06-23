import type { Sport } from '$lib/server/db/schema';
import { listActivitiesForUserInTimeRange } from '$lib/server/repositories/activitiesRepository';
import { listWorkoutLinksForPlannedWorkouts } from '$lib/server/repositories/workoutLinksRepository';
import { listPlannedWorkouts } from '$lib/server/services/plannedWorkoutsService';
import { ensureAutoMatchesForRange } from '$lib/server/services/workoutMatchingService';
import { fallbackLoadScore } from '$lib/server/services/analytics/load';
import { monthEndDate, monthStartDate } from '$lib/validation/localDate';

const DAY_MS = 24 * 60 * 60 * 1000;

const SPORT_DISPLAY: Record<Sport, 'swim' | 'bike' | 'run' | 'other'> = {
	Swim: 'swim',
	Bike: 'bike',
	Run: 'run',
	Strength: 'other',
	Other: 'other'
};

export type CalendarSportKey = 'swim' | 'bike' | 'run' | 'other';

export type CalendarSession = {
	id: string;
	sport: CalendarSportKey;
	sportLabel: Sport;
	title: string;
	tss: number;
	planned: boolean;
	href: string;
};

export type CalendarCell = {
	date: string; // YYYY-MM-DD
	day: number;
	inMonth: boolean;
	isToday: boolean;
	sessions: CalendarSession[];
};

export type CalendarWeek = {
	cells: CalendarCell[];
	tss: number;
	hours: number;
	count: number;
};

export type CalendarMonthData = {
	year: number;
	month: number; // 1-12
	monthLabel: string;
	monthParam: string; // YYYY-MM
	daysInMonth: number;
	todayDate: string | null;
	weeks: CalendarWeek[];
	nav: { prev: string; next: string };
	summary: {
		completed: number;
		planned: number;
		tss: number;
		hours: number;
		weekCount: number;
	};
};

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

function toMonthParam(year: number, month: number): string {
	return `${year}-${pad(month)}`;
}

function localDateIso(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthLongLabel(year: number, month: number): string {
	return new Date(year, month - 1, 1).toLocaleString(undefined, {
		month: 'long',
		year: 'numeric'
	});
}

function loadFor(a: {
	loadScore: number | null;
	sport: Sport;
	durationSec: number | null;
}): number {
	const score = a.loadScore ?? fallbackLoadScore({ sport: a.sport, durationSec: a.durationSec });
	return score ?? 0;
}

export async function getCalendarMonth(input: {
	userId: string;
	year: number;
	month: number; // 1-12
	now?: Date;
}): Promise<CalendarMonthData> {
	const { userId, year, month } = input;
	const fromDate = monthStartDate(year, month);
	const toDate = monthEndDate(year, month);

	const planned = await listPlannedWorkouts({ userId, fromDate, toDate });

	const fromTs = new Date(`${fromDate}T00:00:00`);
	const toTs = new Date(`${toDate}T23:59:59.999`);
	const completed = await listActivitiesForUserInTimeRange({ userId, from: fromTs, to: toTs });

	await ensureAutoMatchesForRange({ userId, fromDate, toDate });

	const links = await listWorkoutLinksForPlannedWorkouts(
		userId,
		planned.map((p) => p.id)
	);
	const linkedActivityIds = new Set(links.map((l) => l.activityId));

	const sessionsByDate = new Map<string, CalendarSession[]>();
	for (const p of planned) {
		const list = sessionsByDate.get(p.scheduledDate) ?? [];
		const sport = SPORT_DISPLAY[p.sport];
		list.push({
			id: p.id,
			sport,
			sportLabel: p.sport,
			title: p.title,
			tss: Math.round(p.plannedLoad ?? 0),
			planned: true,
			href: `/calendar/${p.id}/edit`
		});
		sessionsByDate.set(p.scheduledDate, list);
	}
	for (const a of completed) {
		// Skip activities already linked to a planned workout — those render under the planned entry.
		if (linkedActivityIds.has(a.id)) continue;
		const dateKey = localDateIso(new Date(a.startTime));
		const list = sessionsByDate.get(dateKey) ?? [];
		const sport = SPORT_DISPLAY[a.sport];
		list.push({
			id: a.id,
			sport,
			sportLabel: a.sport,
			title: a.title,
			tss: Math.round(loadFor(a)),
			planned: false,
			href: `/activities/${a.id}`
		});
		sessionsByDate.set(dateKey, list);
	}

	const firstOfMonth = new Date(year, month - 1, 1);
	const firstDow = (firstOfMonth.getDay() + 6) % 7; // 0=Mon..6=Sun
	const daysInMonth = new Date(year, month, 0).getDate();
	const totalCells = firstDow + daysInMonth;
	const weekCount = Math.max(1, Math.ceil(totalCells / 7));

	const gridStart = new Date(firstOfMonth.getTime() - firstDow * DAY_MS);
	const todayIso = localDateIso(input.now ?? new Date());

	const weeks: CalendarWeek[] = [];
	for (let w = 0; w < weekCount; w++) {
		const cells: CalendarCell[] = [];
		let weekTss = 0;
		let weekHours = 0;
		let weekCount2 = 0;
		for (let d = 0; d < 7; d++) {
			const cellDate = new Date(gridStart.getTime() + (w * 7 + d) * DAY_MS);
			const date = localDateIso(cellDate);
			const inMonth = cellDate.getMonth() === month - 1 && cellDate.getFullYear() === year;
			const sessions = inMonth ? (sessionsByDate.get(date) ?? []) : [];
			for (const s of sessions) {
				if (!s.planned) {
					weekTss += s.tss;
					weekCount2++;
				}
			}
			cells.push({
				date,
				day: cellDate.getDate(),
				inMonth,
				isToday: inMonth && date === todayIso,
				sessions
			});
		}
		// Approximate hours from completed durations in the same week.
		// Sum durations for in-month completed activities falling in this week.
		const weekStartTs = gridStart.getTime() + w * 7 * DAY_MS;
		const weekEndTs = weekStartTs + 7 * DAY_MS;
		for (const a of completed) {
			const t = new Date(a.startTime).getTime();
			if (t >= weekStartTs && t < weekEndTs && (a.durationSec ?? 0) > 0) {
				weekHours += (a.durationSec ?? 0) / 3600;
			}
		}
		weeks.push({
			cells,
			tss: weekTss,
			hours: Math.round(weekHours * 10) / 10,
			count: weekCount2
		});
	}

	const totalCompleted = completed.length;
	const totalPlanned = planned.length;
	const monthlyTss = weeks.reduce((acc, w) => acc + w.tss, 0);
	const monthlyHours = Math.round(weeks.reduce((acc, w) => acc + w.hours, 0));

	const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
	const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

	return {
		year,
		month,
		monthLabel: monthLongLabel(year, month),
		monthParam: toMonthParam(year, month),
		daysInMonth,
		todayDate: todayIso,
		weeks,
		nav: {
			prev: toMonthParam(prev.y, prev.m),
			next: toMonthParam(next.y, next.m)
		},
		summary: {
			completed: totalCompleted,
			planned: totalPlanned,
			tss: monthlyTss,
			hours: monthlyHours,
			weekCount: weeks.length
		}
	};
}
