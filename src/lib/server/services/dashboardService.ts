import {
	listActivitiesForUserInTimeRange,
	type DbActivity
} from '$lib/server/repositories/activitiesRepository';
import {
	getActivitiesList,
	type ActivityListRow
} from '$lib/server/services/activitiesListService';
import { loadFor as sharedLoadFor, type ThresholdPrefs } from '$lib/server/services/analytics/load';
import type { Sport } from '$lib/server/db/schema';
import type { UserPreferences } from '$lib/validation/userPreferences';

const DAY_MS = 24 * 60 * 60 * 1000;
const CTL_TC = 42;
const ATL_TC = 7;
const SPORT_DISPLAY: Record<Sport, 'swim' | 'bike' | 'run' | 'other'> = {
	Swim: 'swim',
	Bike: 'bike',
	Run: 'run',
	Strength: 'other',
	Other: 'other'
};

export type DashboardKpis = {
	fitness: number;
	fatigue: number;
	form: string;
	formNum: number;
	weekTss: number;
	ramp: string;
	readinessVal: number;
	readinessLabel: string;
	monotony: string;
	strain: number;
};

export type DashboardSeriesPoint = { i: number; ctl: number; atl: number; tsb: number; dateMs: number };

export type DashboardWeek = {
	w: number;
	swim: number;
	bike: number;
	run: number;
	total: number;
	label: string;
};

export type DashboardZone = { name: string; pct: number; w: string; color: string };
export type DashboardPower = { label: string; val: number };

export type DashboardData = {
	kpis: DashboardKpis;
	series: DashboardSeriesPoint[];
	weeks: DashboardWeek[];
	sport: { swimPct: number; bikePct: number; runPct: number };
	zones: DashboardZone[];
	power: DashboardPower[];
	recent: ActivityListRow[];
	hasData: boolean;
};

function startOfLocalDay(d: Date): Date {
	const out = new Date(d);
	out.setHours(0, 0, 0, 0);
	return out;
}

function localDayIndex(activityDate: Date, windowStart: Date): number {
	const start = startOfLocalDay(windowStart).getTime();
	const day = startOfLocalDay(activityDate).getTime();
	return Math.round((day - start) / DAY_MS);
}

function loadFor(a: DbActivity, prefs: ThresholdPrefs | null): number {
	return sharedLoadFor(a, prefs);
}

function readinessLabel(v: number): string {
	if (v >= 78) return 'Race-ready';
	if (v >= 60) return 'Fresh';
	if (v >= 42) return 'Productive';
	if (v >= 26) return 'Fatigued';
	return 'Overreached';
}

export async function getDashboardData(
	userId: string,
	opts: { now?: Date; days?: number; prefs?: UserPreferences | null } = {}
): Promise<DashboardData> {
	const days = opts.days ?? 84;
	const nowRaw = opts.now ?? new Date();
	const todayStart = startOfLocalDay(nowRaw);
	const todayEnd = new Date(todayStart.getTime() + DAY_MS - 1);
	const windowStart = new Date(todayStart.getTime() - (days - 1) * DAY_MS);
	const prefs = opts.prefs ?? null;

	const [windowActivities, recentList] = await Promise.all([
		listActivitiesForUserInTimeRange({
			userId,
			from: windowStart,
			to: todayEnd
		}),
		getActivitiesList({ userId, limit: 10, prefs })
	]);

	const dailyTss = new Array<number>(days).fill(0);
	const dailyBySport: Record<'swim' | 'bike' | 'run' | 'other', number[]> = {
		swim: new Array<number>(days).fill(0),
		bike: new Array<number>(days).fill(0),
		run: new Array<number>(days).fill(0),
		other: new Array<number>(days).fill(0)
	};

	for (const a of windowActivities) {
		const idx = localDayIndex(new Date(a.startTime), windowStart);
		if (idx < 0 || idx >= days) continue;
		const load = loadFor(a, prefs);
		dailyTss[idx]! += load;
		const disp = SPORT_DISPLAY[a.sport as Sport];
		dailyBySport[disp]![idx]! += load;
	}

	const aC = 1 - Math.exp(-1 / CTL_TC);
	const aA = 1 - Math.exp(-1 / ATL_TC);
	let ctl = 0;
	let atl = 0;
	const series: DashboardSeriesPoint[] = [];
	for (let i = 0; i < days; i++) {
		const t = dailyTss[i]!;
		ctl = ctl + (t - ctl) * aC;
		atl = atl + (t - atl) * aA;
		const dateMs = windowStart.getTime() + i * DAY_MS;
		series.push({ i, ctl, atl, tsb: ctl - atl, dateMs });
	}

	const last = series[series.length - 1]!;
	const prev7 = series[Math.max(0, series.length - 8)]!;
	const rampN = last.ctl - prev7.ctl;

	let weekTss = 0;
	const l7: number[] = [];
	for (let i = Math.max(0, days - 7); i < days; i++) {
		weekTss += dailyTss[i]!;
		l7.push(dailyTss[i]!);
	}
	const mean7 = l7.reduce((acc, v) => acc + v, 0) / Math.max(1, l7.length);
	const sd7Raw = Math.sqrt(
		l7.reduce((acc, v) => acc + (v - mean7) * (v - mean7), 0) / Math.max(1, l7.length)
	);
	const sd7 = sd7Raw || 1;
	const monotonyN = mean7 / sd7;
	const strainN = Math.round(l7.reduce((acc, v) => acc + v, 0) * monotonyN);
	const readinessVal = Math.max(3, Math.min(100, Math.round(50 + last.tsb * 1.6)));

	const kpis: DashboardKpis = {
		fitness: Math.round(last.ctl),
		fatigue: Math.round(last.atl),
		form: (last.tsb >= 0 ? '+' : '') + Math.round(last.tsb),
		formNum: Math.round(last.tsb),
		weekTss: Math.round(weekTss),
		ramp: (rampN >= 0 ? '+' : '') + rampN.toFixed(1),
		readinessVal,
		readinessLabel: readinessLabel(readinessVal),
		monotony: Number.isFinite(monotonyN) ? monotonyN.toFixed(1) : '—',
		strain: strainN
	};

	const weeks: DashboardWeek[] = [];
	const weekCount = Math.floor(days / 7);
	for (let w = 0; w < weekCount; w++) {
		let swim = 0;
		let bike = 0;
		let run = 0;
		for (let d = 0; d < 7; d++) {
			const idx = w * 7 + d;
			swim += dailyBySport.swim[idx]!;
			bike += dailyBySport.bike[idx]!;
			run += dailyBySport.run[idx]!;
		}
		const dt = new Date(windowStart.getTime() + w * 7 * DAY_MS);
		weeks.push({
			w,
			swim: Math.round(swim),
			bike: Math.round(bike),
			run: Math.round(run),
			total: Math.round(swim + bike + run),
			label: `${dt.getMonth() + 1}/${dt.getDate()}`
		});
	}

	const sportTotals = { swim: 0, bike: 0, run: 0 };
	for (const a of windowActivities) {
		const disp = SPORT_DISPLAY[a.sport as Sport];
		if (disp === 'swim' || disp === 'bike' || disp === 'run') sportTotals[disp] += loadFor(a, prefs);
	}
	const sportSum = sportTotals.swim + sportTotals.bike + sportTotals.run;
	const sport =
		sportSum > 0
			? {
					swimPct: Math.round((sportTotals.swim / sportSum) * 100),
					bikePct: Math.round((sportTotals.bike / sportSum) * 100),
					runPct: Math.round((sportTotals.run / sportSum) * 100)
				}
			: { swimPct: 0, bikePct: 0, runPct: 0 };

	// Time-in-zone and power profile require per-activity HR/power stream parsing,
	// which the backend does not currently expose. Placeholders match the design's
	// shape; replace with real aggregations once stream analysis lands.
	const zones: DashboardZone[] = [
		{ name: 'Z1 · Recovery', pct: 27, w: '27%', color: '#9fc2a8' },
		{ name: 'Z2 · Endurance', pct: 42, w: '42%', color: '#3c7a53' },
		{ name: 'Z3 · Tempo', pct: 16, w: '16%', color: '#d2a03a' },
		{ name: 'Z4 · Threshold', pct: 10, w: '10%', color: '#c0892e' },
		{ name: 'Z5 · VO₂', pct: 5, w: '5%', color: '#9a4b2e' }
	];
	const power: DashboardPower[] = [
		{ label: '5 s', val: 1180 },
		{ label: '1 min', val: 640 },
		{ label: '5 min', val: 388 },
		{ label: '20 min', val: 312 },
		{ label: 'FTP', val: 296 }
	];

	return {
		kpis,
		series,
		weeks,
		sport,
		zones,
		power,
		recent: recentList.rows,
		hasData: windowActivities.length > 0
	};
}
