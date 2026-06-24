// Pure client-side filter + sort logic for the activities list. Kept out of the
// Svelte component so the fiddly bits (range bounds, missing-value handling,
// sort direction) are unit-testable without a browser/component harness.

export type SportValue = 'swim' | 'bike' | 'run' | 'other';

/** The subset of an activity-list row this module reads. Generic helpers below
 *  preserve the caller's concrete row type, so render-only fields survive. */
export type FilterableRow = {
	sport: SportValue;
	sportLabel: string;
	title: string;
	searchText: string;
	startTimeMs: number;
	distanceM: number;
	distanceDisplay: number;
	durationSec: number;
	tss: number;
	intensityFactor: number | null;
	avgHr: number | null;
};

export type FilterKey = 'all' | 'swim' | 'bike' | 'run';
export type MetricKey = 'distance' | 'duration' | 'tss' | 'if' | 'hr';
export type Range = { min: number | null; max: number | null };
export type Ranges = Record<MetricKey, Range>;
export type SortKey = 'date' | 'sport' | 'title' | 'distance' | 'duration' | 'tss' | 'if' | 'hr';
export type SortDir = 'asc' | 'desc';

/** Presentation metadata for the range-filter metrics — the single source of
 *  truth for which metrics exist and in what order. `unit: null` means "use the
 *  user's distance unit" (km|mi), which only the component knows at render time. */
export type MetricDef = { key: MetricKey; label: string; unit: string | null; step: string };
export const METRIC_DEFS: MetricDef[] = [
	{ key: 'distance', label: 'Distance', unit: null, step: '0.1' },
	{ key: 'duration', label: 'Duration', unit: 'min', step: '1' },
	{ key: 'tss', label: 'TSS', unit: '', step: '1' },
	{ key: 'if', label: 'IF', unit: '', step: '0.01' },
	{ key: 'hr', label: 'Avg HR', unit: 'bpm', step: '1' }
];
export const METRIC_KEYS: MetricKey[] = METRIC_DEFS.map((m) => m.key);

export function emptyRanges(): Ranges {
	return {
		distance: { min: null, max: null },
		duration: { min: null, max: null },
		tss: { min: null, max: null },
		if: { min: null, max: null },
		hr: { min: null, max: null }
	};
}

/** How many metrics have at least one bound set (drives the toggle's badge). */
export function activeRangeCount(ranges: Ranges): number {
	return METRIC_KEYS.filter((k) => ranges[k].min !== null || ranges[k].max !== null).length;
}

/** True when `value` is within [min, max]. A missing value (null) fails any
 *  active bound — so once you filter on a metric, activities lacking it drop out. */
export function withinBound(value: number | null, range: Range): boolean {
	if (range.min !== null && (value === null || value < range.min)) return false;
	if (range.max !== null && (value === null || value > range.max)) return false;
	return true;
}

/** Round to the precision the table shows for each column, so a bound matches
 *  what the user sees. Without this a row rendered as IF "0.85" (really 0.854)
 *  would be excluded by an IF max of 0.85. Cells show distance to 0.1, IF to
 *  0.01, and HR / duration-minutes to whole numbers. */
function roundTo(value: number, decimals: number): number {
	const f = 10 ** decimals;
	return Math.round(value * f) / f;
}

export function filterRows<T extends FilterableRow>(
	rows: T[],
	sport: FilterKey,
	needle: string,
	ranges: Ranges
): T[] {
	return rows.filter(
		(row) =>
			(sport === 'all' || row.sport === sport) &&
			(needle === '' || row.searchText.includes(needle)) &&
			// Distance/duration are filtered in display units (km|mi / minutes), and
			// every value is rounded to the precision its column shows so the bound
			// matches what the user sees. A 0 means "no value", treated as missing.
			withinBound(row.distanceDisplay > 0 ? roundTo(row.distanceDisplay, 1) : null, ranges.distance) &&
			withinBound(row.durationSec > 0 ? Math.round(row.durationSec / 60) : null, ranges.duration) &&
			withinBound(row.tss, ranges.tss) &&
			withinBound(row.intensityFactor === null ? null : roundTo(row.intensityFactor, 2), ranges.if) &&
			withinBound(row.avgHr === null ? null : Math.round(row.avgHr), ranges.hr)
	);
}

const SORT_VALUE: Record<SortKey, (r: FilterableRow) => number | string | null> = {
	date: (r) => r.startTimeMs,
	sport: (r) => r.sportLabel,
	title: (r) => r.title.toLowerCase(),
	distance: (r) => (r.distanceM > 0 ? r.distanceM : null),
	duration: (r) => (r.durationSec > 0 ? r.durationSec : null),
	tss: (r) => r.tss,
	if: (r) => r.intensityFactor,
	hr: (r) => r.avgHr
};

/** Sort by a column. Missing values (null) always sort last regardless of
 *  direction, so empty cells don't crowd the top of an ascending sort. */
export function sortRows<T extends FilterableRow>(rows: T[], key: SortKey, dir: SortDir): T[] {
	const get = SORT_VALUE[key];
	return [...rows].sort((a, b) => {
		const av = get(a);
		const bv = get(b);
		if (av === null && bv === null) return 0;
		if (av === null) return 1;
		if (bv === null) return -1;
		const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : av - (bv as number);
		return dir === 'desc' ? -cmp : cmp;
	});
}
