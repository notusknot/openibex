import {
	getActivityByIdForUser,
	type DbActivity
} from '$lib/server/repositories/activitiesRepository';
import {
	getActivityDetail,
	type ActivityDetailData,
	type ActivitySummaryStat
} from '$lib/server/services/activityDetailService';
import {
	intensityFactorFor,
	loadFor,
	type ThresholdPrefs
} from '$lib/server/services/analytics/load';
import type { UserPreferences } from '$lib/validation/userPreferences';
import {
	distanceFromMeters,
	distanceUnit,
	elevationUnit,
	paceFromSecPerKm,
	M_PER_FT,
	type Units
} from '$lib/units';

// One stat row: the already-formatted A and B values (reused verbatim from each
// activity's summary bar) plus the B − A delta. `delta` is null where a row has
// no sensible numeric difference (e.g. a missing value on either side).
export type ComparisonRow = { label: string; a: string; b: string; delta: string | null };

export type ActivityComparison = {
	a: ActivityDetailData | null;
	b: ActivityDetailData | null;
	stats: ComparisonRow[];
};

/**
 * Load two activities for a side-by-side comparison. Reuses `getActivityDetail`
 * for the shaped track + summary stats of each side, and the raw rows for the
 * numeric deltas. Returns nulls (→ the page shows a "couldn't load" state) when
 * either id is missing or not owned by the user; `stats` is empty unless both
 * sides resolve.
 */
export async function getActivityComparison(input: {
	userId: string;
	idA: string;
	idB: string;
	prefs?: UserPreferences | null;
}): Promise<ActivityComparison> {
	const { userId, idA, idB } = input;
	const prefs = input.prefs ?? null;

	const [a, b, rawA, rawB] = await Promise.all([
		getActivityDetail({ userId, activityId: idA, prefs }),
		getActivityDetail({ userId, activityId: idB, prefs }),
		getActivityByIdForUser(idA, userId),
		getActivityByIdForUser(idB, userId)
	]);

	if (!a || !b || !rawA || !rawB) return { a, b, stats: [] };

	const units: Units = prefs?.units ?? 'imperial';
	return { a, b, stats: buildStats(a, b, rawA, rawB, prefs as ThresholdPrefs | null, units) };
}

// `getActivityDetail` always emits the 8 summary cells in the same order, so the
// two arrays line up by index — zip them for the A/B columns and attach a delta
// keyed off the (stable) label.
function buildStats(
	a: ActivityDetailData,
	b: ActivityDetailData,
	rawA: DbActivity,
	rawB: DbActivity,
	prefs: ThresholdPrefs | null,
	units: Units
): ComparisonRow[] {
	const n = Math.min(a.summaryStats.length, b.summaryStats.length);
	const rows: ComparisonRow[] = [];
	for (let i = 0; i < n; i++) {
		const sa = a.summaryStats[i]!;
		const sb = b.summaryStats[i]!;
		rows.push({
			label: sa.label,
			a: combine(sa),
			b: combine(sb),
			delta: deltaFor(sa.label, rawA, rawB, prefs, units)
		});
	}
	return rows;
}

function combine(stat: ActivitySummaryStat): string {
	if (stat.val === '—') return '—';
	return stat.unit ? `${stat.val} ${stat.unit}` : stat.val;
}

// Delta = B − A, formatted in the same units as the column. Returns null for any
// row whose underlying number is missing on either side (column already shows
// an em-dash) or has no meaningful difference.
function deltaFor(
	label: string,
	rawA: DbActivity,
	rawB: DbActivity,
	prefs: ThresholdPrefs | null,
	units: Units
): string | null {
	switch (label) {
		case 'Duration':
			return durationDelta(rawA.durationSec, rawB.durationSec);
		case 'Distance':
			return distanceDelta(rawA.distanceM, rawB.distanceM, units);
		case 'TSS': {
			const ta = Math.round(loadFor(rawA, prefs));
			const tb = Math.round(loadFor(rawB, prefs));
			return ta > 0 && tb > 0 ? signedInt(tb - ta, '') : null;
		}
		case 'IF': {
			const ia = intensityFactorFor(rawA, prefs);
			const ib = intensityFactorFor(rawB, prefs);
			return ia !== null && ib !== null ? signedFixed(ib - ia, 2) : null;
		}
		case 'Avg pace':
			return paceDelta(avgPaceSecPerKm(rawA), avgPaceSecPerKm(rawB), units);
		case 'Avg HR':
			return numDelta(rawA.avgHr, rawB.avgHr, 'bpm');
		case 'Elevation':
			return elevationDelta(rawA.elevationGainM, rawB.elevationGainM, units);
		case 'Calories':
			return numDelta(rawA.calories, rawB.calories, '');
		default:
			return null;
	}
}

function avgPaceSecPerKm(a: DbActivity): number | null {
	// Pace isn't shown for rides (matches the summary bar), and needs distance + time.
	if (a.sport === 'Bike') return null;
	const km = (a.distanceM ?? 0) / 1000;
	if (km <= 0 || !a.durationSec || a.durationSec <= 0) return null;
	return a.durationSec / km;
}

function durationDelta(a: number | null, b: number | null): string | null {
	if (!a || !b || a <= 0 || b <= 0) return null;
	const d = b - a;
	const sign = d < 0 ? '-' : d > 0 ? '+' : '';
	const s = Math.abs(Math.round(d));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	const body =
		h > 0
			? `${h}:${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
			: `${m}:${ss.toString().padStart(2, '0')}`;
	return `${sign}${body}`;
}

function distanceDelta(a: number | null, b: number | null, units: Units): string | null {
	if (!a || !b || a <= 0 || b <= 0) return null;
	const d = distanceFromMeters(b, units) - distanceFromMeters(a, units);
	return `${d > 0 ? '+' : ''}${d.toFixed(2)} ${distanceUnit(units)}`;
}

function paceDelta(a: number | null, b: number | null, units: Units): string | null {
	if (a === null || b === null) return null;
	const d = paceFromSecPerKm(b, units) - paceFromSecPerKm(a, units);
	const sign = d < 0 ? '-' : d > 0 ? '+' : '';
	const s = Math.abs(Math.round(d));
	return `${sign}${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function elevationDelta(a: number | null, b: number | null, units: Units): string | null {
	if (a === null || a === undefined || b === null || b === undefined) return null;
	const d = b - a;
	const v = units === 'imperial' ? d / M_PER_FT : d;
	return `${v > 0 ? '+' : ''}${Math.round(v)} ${elevationUnit(units)}`;
}

function numDelta(a: number | null, b: number | null, unit: string): string | null {
	if (a === null || a === undefined || b === null || b === undefined) return null;
	return signedInt(Math.round(b) - Math.round(a), unit);
}

function signedInt(d: number, unit: string): string {
	return `${d > 0 ? '+' : ''}${d}${unit ? ` ${unit}` : ''}`;
}

function signedFixed(d: number, decimals: number): string {
	return `${d > 0 ? '+' : ''}${d.toFixed(decimals)}`;
}
