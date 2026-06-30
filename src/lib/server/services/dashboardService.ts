import {
	listActivitiesForUserInTimeRange,
	type DbActivity
} from '$lib/server/repositories/activitiesRepository';
import {
	getActivitiesList,
	type ActivityListRow
} from '$lib/server/services/activitiesListService';
import { loadFor as sharedLoadFor, type ThresholdPrefs } from '$lib/server/services/analytics/load';
import {
	STREAM_METRICS_VERSION,
	addHistogramZoneSeconds,
	computeActivityStreamMetrics,
	maxBpmInHistogram,
	serializeStreamMetrics,
	type ActivityStreamMetrics,
	type HrHistogram,
	type PowerCurve
} from '$lib/server/services/analytics/streamAggregates';
import {
	getStreamMetricsForActivityIds,
	upsertActivityStreamMetrics
} from '$lib/server/repositories/activityStreamMetricsRepository';
import { readStreamBlob } from '$lib/server/services/fileStorageService';
import { startOfLocalDay } from '$lib/server/time';
import type { Sport } from '$lib/server/db/schema';
import { SPORT_DISPLAY } from '$lib/server/sport';
import { HR_ZONE_COLORS, HR_ZONE_NAMES } from '$lib/zones';
import type { UserPreferences } from '$lib/validation/userPreferences';

const DAY_MS = 24 * 60 * 60 * 1000;
const CTL_TC = 42;
const ATL_TC = 7;

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

// Self-explaining indicator for a KPI card ("Combination" / Option D in the
// design): a one-word verdict plus a track showing where the value sits
// relative to its ideal band. `tone` keys into the --st-* theme tokens so the
// chip, marker, and shaded zone recolor with light/dark.
export type KpiTone = 'good' | 'warn' | 'easy' | 'bad' | 'neutral';
export type KpiIndicator = {
	status: string; // verdict word, e.g. 'Fresh', 'Building', 'Overload'
	tone: KpiTone;
	markerPct: number; // 0–100, current value's position on the track
	zoneStart: number; // 0–100, left edge of the ideal band
	zoneWidth: number; // 0–100, width of the ideal band (0 = no band drawn)
	lo: string; // left scale label
	hi: string; // right scale label
};

export type DashboardIndicators = {
	fitness: KpiIndicator;
	fatigue: KpiIndicator;
	form: KpiIndicator;
	weekTss: KpiIndicator;
	readiness: KpiIndicator;
	monotony: KpiIndicator;
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
	indicators: DashboardIndicators;
	series: DashboardSeriesPoint[];
	weeks: DashboardWeek[];
	sport: { swimPct: number; bikePct: number; runPct: number };
	zones: DashboardZone[];
	power: DashboardPower[];
	recent: ActivityListRow[];
	hasData: boolean;
};

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

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
// Position of `v` on a [min,max] track, as a 0–100 percentage. Exported for tests.
export const trackPct = (v: number, min: number, max: number) =>
	max > min ? clamp(((v - min) / (max - min)) * 100, 0, 100) : 0;
const round1 = (x: number) => Math.round(x * 10) / 10;

const NEUTRAL_INDICATOR: KpiIndicator = {
	status: '—',
	tone: 'neutral',
	markerPct: 0,
	zoneStart: 0,
	zoneWidth: 0,
	lo: '',
	hi: ''
};

// Derives the self-explaining indicator for each KPI from its live value. These
// bands are coaching heuristics (CTL/ATL ratios, TSB ranges, monotony cutoffs),
// not hard rules — tune them here. Several metrics are scaled relative to the
// athlete's own fitness (CTL) since "ideal" fatigue and weekly load depend on it.
export function buildKpiIndicators(args: {
	ctl: number;
	atl: number;
	tsb: number;
	weekTss: number;
	rampN: number;
	readinessVal: number;
	readinessLabel: string;
	monotonyN: number;
	hasData: boolean;
}): DashboardIndicators {
	const { ctl, atl, tsb, weekTss, rampN, readinessVal, monotonyN, hasData } = args;

	if (!hasData) {
		return {
			fitness: NEUTRAL_INDICATOR,
			fatigue: NEUTRAL_INDICATOR,
			form: NEUTRAL_INDICATOR,
			weekTss: NEUTRAL_INDICATOR,
			readiness: NEUTRAL_INDICATOR,
			monotony: NEUTRAL_INDICATOR
		};
	}

	const ref = Math.max(ctl, 1); // fitness reference for ratio-based bands

	// Fitness (CTL): higher is better, but the actionable signal is the build
	// rate (ramp). Marker is the value; the band is a sustainable-build target.
	const fitMax = Math.max(60, Math.ceil((ctl * 1.3) / 10) * 10);
	const fitness: KpiIndicator = {
		...(rampN >= 8
			? { status: 'Spiking', tone: 'warn' as KpiTone }
			: rampN >= 3
				? { status: 'Building', tone: 'good' as KpiTone }
				: rampN > -2
					? { status: 'Steady', tone: 'good' as KpiTone }
					: rampN > -6
						? { status: 'Easing', tone: 'easy' as KpiTone }
						: { status: 'Detraining', tone: 'warn' as KpiTone }),
		markerPct: round1(trackPct(ctl, 0, fitMax)),
		zoneStart: 50,
		zoneWidth: 35,
		lo: '0',
		hi: String(fitMax)
	};

	// Fatigue (ATL): meaningful relative to fitness. ATL ≈ CTL is normal training
	// load; well above means accumulating fatigue, well below means freshened up.
	const fatMax = Math.max(50, Math.ceil((ref * 1.8) / 10) * 10);
	const fatRatio = atl / ref;
	const fatZoneStart = trackPct(0.7 * ref, 0, fatMax);
	const fatigue: KpiIndicator = {
		...(fatRatio < 0.7
			? { status: 'Low', tone: 'good' as KpiTone }
			: fatRatio <= 1.1
				? { status: 'Normal', tone: 'good' as KpiTone }
				: fatRatio <= 1.4
					? { status: 'High', tone: 'warn' as KpiTone }
					: { status: 'Very high', tone: 'bad' as KpiTone }),
		markerPct: round1(trackPct(atl, 0, fatMax)),
		zoneStart: round1(fatZoneStart),
		zoneWidth: round1(trackPct(1.1 * ref, 0, fatMax) - fatZoneStart),
		lo: '0',
		hi: String(fatMax)
	};

	// Form (TSB): the band-shaped metric. Below 0 = carrying fatigue (normal in a
	// build); a moderate positive band is fresh/productive; very high = detraining.
	const form: KpiIndicator = {
		...(tsb > 20
			? { status: 'Peaked', tone: 'easy' as KpiTone }
			: tsb >= 8
				? { status: 'Fresh', tone: 'good' as KpiTone }
				: tsb >= -10
					? { status: 'Balanced', tone: 'good' as KpiTone }
					: tsb >= -25
						? { status: 'Fatigued', tone: 'warn' as KpiTone }
						: { status: 'Overreached', tone: 'bad' as KpiTone }),
		markerPct: round1(trackPct(tsb, -30, 30)),
		zoneStart: round1(trackPct(-10, -30, 30)),
		zoneWidth: round1(trackPct(10, -30, 30) - trackPct(-10, -30, 30)),
		lo: '−30',
		hi: '+30'
	};

	// Week TSS: judged against a sustainable weekly load (≈ CTL × 7). Easing below
	// it, productive around it, overload well above.
	const sustainable = ref * 7;
	const wkMax = Math.max(300, Math.ceil((sustainable * 1.6) / 50) * 50);
	const wkRatio = weekTss / sustainable;
	const wkZoneStart = trackPct(0.8 * sustainable, 0, wkMax);
	const weekTssInd: KpiIndicator = {
		...(wkRatio < 0.6
			? { status: 'Easing', tone: 'easy' as KpiTone }
			: wkRatio <= 1.3
				? { status: 'On track', tone: 'good' as KpiTone }
				: wkRatio <= 1.6
					? { status: 'Loading', tone: 'warn' as KpiTone }
					: { status: 'Overload', tone: 'bad' as KpiTone }),
		markerPct: round1(trackPct(weekTss, 0, wkMax)),
		zoneStart: round1(wkZoneStart),
		zoneWidth: round1(trackPct(1.3 * sustainable, 0, wkMax) - wkZoneStart),
		lo: '0',
		hi: String(wkMax)
	};

	// Readiness (0–100): derived from TSB, higher = fresher. Reuse the word verdict.
	const readiness: KpiIndicator = {
		status: args.readinessLabel,
		tone: readinessVal >= 42 ? 'good' : readinessVal >= 26 ? 'warn' : 'bad',
		markerPct: round1(trackPct(readinessVal, 0, 100)),
		zoneStart: 55,
		zoneWidth: 33,
		lo: '0',
		hi: '100'
	};

	// Monotony: lower is more varied (healthier). The ideal band is the low end;
	// above ~2 every day looks the same, which raises strain/illness risk.
	const monotony: KpiIndicator = Number.isFinite(monotonyN)
		? {
				...(monotonyN < 1.5
					? { status: 'Varied', tone: 'good' as KpiTone }
					: monotonyN < 2
						? { status: 'Moderate', tone: 'warn' as KpiTone }
						: { status: 'Monotonous', tone: 'bad' as KpiTone }),
				markerPct: round1(trackPct(monotonyN, 0, 2.5)),
				zoneStart: 0,
				zoneWidth: 60,
				lo: '0',
				hi: '2.5'
			}
		: NEUTRAL_INDICATOR;

	return { fitness, fatigue, form, weekTss: weekTssInd, readiness, monotony };
}

// Power-profile card points (mean-maximal watts), in seconds. Each maps to a key
// in the stored power curve (see POWER_CURVE_DURATIONS).
const POWER_TARGETS: { label: string; sec: number }[] = [
	{ label: '5 s', sec: 5 },
	{ label: '1 min', sec: 60 },
	{ label: '5 min', sec: 300 },
	{ label: '20 min', sec: 1200 }
];
const BEST_20MIN_SEC = 1200;

// Resolve each in-window activity's precomputed stream metrics, lazily
// self-healing rows that are missing or computed by an older algorithm version:
// read that one stream, recompute, persist, and use the fresh value. So the
// dashboard works on a fresh clone (before the backfill CLI runs) and auto-heals
// across version bumps, while the steady state does ZERO stream reads.
async function resolveStreamMetrics(
	activities: DbActivity[]
): Promise<Map<string, ActivityStreamMetrics>> {
	const withStreams = activities.filter((a) => a.streamPath);
	const rows = await getStreamMetricsForActivityIds(withStreams.map((a) => a.id));
	const byId = new Map(rows.map((r) => [r.activityId, r]));

	const out = new Map<string, ActivityStreamMetrics>();
	const stale: DbActivity[] = [];
	for (const a of withStreams) {
		const row = byId.get(a.id);
		if (row && row.version === STREAM_METRICS_VERSION) {
			out.set(a.id, {
				version: row.version,
				hrHistogram: row.hrHistogramJson ? (JSON.parse(row.hrHistogramJson) as HrHistogram) : null,
				powerCurve: row.powerCurveJson ? (JSON.parse(row.powerCurveJson) as PowerCurve) : null
			});
		} else {
			stale.push(a);
		}
	}

	// Heal stale/missing rows with BOUNDED concurrency. Each heal reads +
	// gunzips + re-aggregates a multi-MB stream blob; an unbounded Promise.all
	// over a whole stale window (after a STREAM_METRICS_VERSION bump, or on a
	// fresh clone before the backfill CLI runs) would read hundreds of MB at once
	// and stall the dashboard. The steady state has zero stale rows, so this loop
	// is skipped entirely.
	const HEAL_CONCURRENCY = 4;
	for (let i = 0; i < stale.length; i += HEAL_CONCURRENCY) {
		await Promise.all(
			stale.slice(i, i + HEAL_CONCURRENCY).map(async (a) => {
				try {
					const metrics = computeActivityStreamMetrics(await readStreamBlob(a.id));
					out.set(a.id, metrics);
					await upsertActivityStreamMetrics({
						activityId: a.id,
						userId: a.userId,
						...serializeStreamMetrics(metrics)
					});
				} catch {
					// A missing/corrupt stream just means this activity contributes nothing.
				}
			})
		);
	}

	return out;
}

// Build the real "Time in zone" and "Power profile" cards by aggregating the
// per-activity precomputed metrics across the window:
//   • zones  — HR histograms re-bucketed into Z1–Z5 (per activity, against the
//     athlete's configured max HR when set, else that activity's own max) and
//     summed, shown as a % of total HR time. Empty when no activity recorded HR.
//   • power  — max of each duration's mean-maximal watts across activities, at
//     5 s / 1 min / 5 min / 20 min, plus FTP (configured, else ≈95% of the best
//     20 min). Empty for athletes with no power meter, so the card shows an
//     unavailable state instead of invented numbers.
export async function computeStreamCards(
	activities: DbActivity[],
	prefs: UserPreferences | null
): Promise<{ zones: DashboardZone[]; power: DashboardPower[] }> {
	const metricsById = await resolveStreamMetrics(activities);

	const userMaxHr = prefs?.maxHrBpm && prefs.maxHrBpm > 100 ? prefs.maxHrBpm : null;
	const zoneSeconds = [0, 0, 0, 0, 0];
	const bestPower = new Map<number, number>(); // window seconds → best avg watts

	for (const a of activities) {
		const m = metricsById.get(a.id);
		if (!m) continue;

		if (m.hrHistogram) {
			const maxRef =
				userMaxHr ??
				(a.maxHr && a.maxHr > 100 ? a.maxHr : maxBpmInHistogram(m.hrHistogram));
			addHistogramZoneSeconds(zoneSeconds, m.hrHistogram, maxRef);
		}

		// Only activities that actually recorded power contribute to the curve.
		if (m.powerCurve) {
			for (const t of POWER_TARGETS) {
				const best = m.powerCurve[String(t.sec)];
				if (best === undefined) continue;
				const prev = bestPower.get(t.sec);
				if (prev === undefined || best > prev) bestPower.set(t.sec, best);
			}
		}
	}

	const totalZoneSec = zoneSeconds.reduce((a, b) => a + b, 0);
	const zones: DashboardZone[] =
		totalZoneSec > 0
			? zoneSeconds.map((sec, i) => {
					const pct = Math.round((sec / totalZoneSec) * 100);
					return { name: HR_ZONE_NAMES[i]!, pct, w: `${pct}%`, color: HR_ZONE_COLORS[i]! };
				})
			: [];

	const power: DashboardPower[] = [];
	for (const t of POWER_TARGETS) {
		const v = bestPower.get(t.sec);
		if (v !== undefined) power.push({ label: t.label, val: Math.round(v) });
	}
	if (power.length > 0) {
		const configuredFtp = prefs?.ftpWatts && prefs.ftpWatts > 0 ? prefs.ftpWatts : null;
		const best20 = bestPower.get(BEST_20MIN_SEC);
		const ftp = configuredFtp ?? (best20 !== undefined ? Math.round(best20 * 0.95) : null);
		if (ftp !== null) power.push({ label: 'FTP', val: Math.round(ftp) });
	}

	return { zones, power };
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

	const indicators = buildKpiIndicators({
		ctl: last.ctl,
		atl: last.atl,
		tsb: last.tsb,
		weekTss,
		rampN,
		readinessVal,
		readinessLabel: kpis.readinessLabel,
		monotonyN,
		hasData: windowActivities.length > 0
	});

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

	// Time-in-zone and power profile are aggregated from the per-activity HR/power
	// streams over the same window. Both degrade gracefully: zones is empty when no
	// activity recorded HR, power is empty when none recorded watts (no power meter).
	const { zones, power } = await computeStreamCards(windowActivities, prefs);

	return {
		kpis,
		indicators,
		series,
		weeks,
		sport,
		zones,
		power,
		recent: recentList.rows,
		hasData: windowActivities.length > 0
	};
}
