import type { Sport } from '$lib/server/db/schema';
import {
	listActivitiesForUserInTimeRangeRepo,
	listPlannedWorkoutsForUserInDateRangeRepo,
	listWorkoutLinksForUserInDateRangeRepo
} from '$lib/server/repositories/analyticsRepository';
import { fallbackLoadScore } from '$lib/server/services/analytics/load';
import { weekStartIsoMonday } from '$lib/server/services/analytics/time';
import { formatLocalDate as localDateIso } from '$lib/validation/localDate';

export type WeeklyRow = {
	weekStart: string; // YYYY-MM-DD Monday
	completed: { durationSec: number; distanceM: number; elevationM: number; load: number };
	planned: { durationSec: number; distanceM: number; load: number };
	compliance: { durationPct: number | null; distancePct: number | null; loadPct: number | null };
};

export type FitnessRow = { date: string; load: number; fitness: number; fatigue: number; freshness: number };

function clampTo0(x: number | null | undefined): number {
	return x && Number.isFinite(x) ? x : 0;
}

function ratio(sumCompleted: number, sumPlanned: number): number | null {
	if (sumPlanned <= 0) return null;
	return sumCompleted / sumPlanned;
}

export async function getWeeklyAnalytics(input: {
	userId: string;
	fromDate: string; // YYYY-MM-DD inclusive
	toDate: string; // YYYY-MM-DD inclusive
	sport?: Sport;
}): Promise<WeeklyRow[]> {
	const from = new Date(`${input.fromDate}T00:00:00`);
	const to = new Date(`${input.toDate}T23:59:59.999`);

	const [activities, planned, linked] = await Promise.all([
		listActivitiesForUserInTimeRangeRepo({ userId: input.userId, from, to }),
		listPlannedWorkoutsForUserInDateRangeRepo({ userId: input.userId, fromDate: input.fromDate, toDate: input.toDate, sport: input.sport }),
		listWorkoutLinksForUserInDateRangeRepo({ userId: input.userId, fromDate: input.fromDate, toDate: input.toDate, sport: input.sport })
	]);

	const byWeek = new Map<string, WeeklyRow>();
	function ensureWeek(weekStart: string): WeeklyRow {
		const existing = byWeek.get(weekStart);
		if (existing) return existing;
		const row: WeeklyRow = {
			weekStart,
			completed: { durationSec: 0, distanceM: 0, elevationM: 0, load: 0 },
			planned: { durationSec: 0, distanceM: 0, load: 0 },
			compliance: { durationPct: null, distancePct: null, loadPct: null }
		};
		byWeek.set(weekStart, row);
		return row;
	}

	for (const a of (input.sport ? activities.filter((x) => x.sport === input.sport) : activities)) {
		const weekStart = weekStartIsoMonday(new Date(a.startTime));
		const row = ensureWeek(weekStart);
		row.completed.durationSec += clampTo0(a.durationSec);
		row.completed.distanceM += clampTo0(a.distanceM);
		row.completed.elevationM += clampTo0(a.elevationGainM);
		const load = a.loadScore ?? fallbackLoadScore({ sport: a.sport as Sport, durationSec: a.durationSec ?? null }) ?? 0;
		row.completed.load += load;
	}

	for (const p of planned) {
		const weekStart = weekStartIsoMonday(new Date(`${p.scheduledDate}T12:00:00`));
		const row = ensureWeek(weekStart);
		row.planned.durationSec += clampTo0(p.plannedDurationSec);
		row.planned.distanceM += clampTo0(p.plannedDistanceM);
		row.planned.load += clampTo0(p.plannedLoad);
	}

	// Compliance: compute from linked totals (sum completed / sum planned) for each metric.
	const totalsByWeek = new Map<
		string,
		{ plannedDuration: number; completedDuration: number; plannedDistance: number; completedDistance: number; plannedLoad: number; completedLoad: number }
	>();

	for (const r of linked) {
		const weekStart = weekStartIsoMonday(new Date(`${r.planned.scheduledDate}T12:00:00`));
		const t =
			totalsByWeek.get(weekStart) ?? {
				plannedDuration: 0,
				completedDuration: 0,
				plannedDistance: 0,
				completedDistance: 0,
				plannedLoad: 0,
				completedLoad: 0
			};

		t.plannedDuration += clampTo0(r.planned.plannedDurationSec);
		t.completedDuration += clampTo0(r.activity.durationSec);
		t.plannedDistance += clampTo0(r.planned.plannedDistanceM);
		t.completedDistance += clampTo0(r.activity.distanceM);
		t.plannedLoad += clampTo0(r.planned.plannedLoad);

		const completedLoad =
			r.activity.loadScore ?? fallbackLoadScore({ sport: r.activity.sport as Sport, durationSec: r.activity.durationSec ?? null }) ?? 0;
		t.completedLoad += completedLoad;

		totalsByWeek.set(weekStart, t);
	}

	for (const [weekStart, row] of byWeek.entries()) {
		const t = totalsByWeek.get(weekStart);
		if (!t) continue;
		row.compliance.durationPct = ratio(t.completedDuration, t.plannedDuration);
		row.compliance.distancePct = ratio(t.completedDistance, t.plannedDistance);
		row.compliance.loadPct = ratio(t.completedLoad, t.plannedLoad);
	}

	return [...byWeek.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

export async function getFitnessSeries(input: {
	userId: string;
	fromDate: string;
	toDate: string;
	longWindowDays?: number;
	shortWindowDays?: number;
}): Promise<FitnessRow[]> {
	const longWindow = input.longWindowDays ?? 42;
	const shortWindow = input.shortWindowDays ?? 7;

	const from = new Date(`${input.fromDate}T00:00:00`);
	const to = new Date(`${input.toDate}T23:59:59.999`);
	const activities = await listActivitiesForUserInTimeRangeRepo({ userId: input.userId, from, to });

	const loadByDate = new Map<string, number>();
	for (const a of activities) {
		const d = localDateIso(new Date(a.startTime));
		const prev = loadByDate.get(d) ?? 0;
		const load = a.loadScore ?? fallbackLoadScore({ sport: a.sport as Sport, durationSec: a.durationSec ?? null }) ?? 0;
		loadByDate.set(d, prev + load);
	}

	// build daily series inclusive
	const days: string[] = [];
	for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
		days.push(localDateIso(cursor));
	}

	function rollingAvg(endIdx: number, window: number): number {
		const start = Math.max(0, endIdx - window + 1);
		let sum = 0;
		for (let i = start; i <= endIdx; i++) sum += loadByDate.get(days[i]!) ?? 0;
		return sum / (endIdx - start + 1);
	}

	const out: FitnessRow[] = [];
	for (let i = 0; i < days.length; i++) {
		const load = loadByDate.get(days[i]!) ?? 0;
		const fitness = rollingAvg(i, longWindow);
		const fatigue = rollingAvg(i, shortWindow);
		out.push({ date: days[i]!, load, fitness, fatigue, freshness: fitness - fatigue });
	}
	return out;
}
