import { describe, expect, it } from 'vitest';
import {
	activeRangeCount,
	emptyRanges,
	filterRows,
	sortRows,
	withinBound,
	type FilterableRow,
	type Ranges
} from './filterSort';

function row(p: Partial<FilterableRow>): FilterableRow {
	return {
		sport: 'run',
		sportLabel: 'Run',
		title: 'Activity',
		searchText: 'activity',
		startTimeMs: 0,
		distanceM: 0,
		distanceDisplay: 0,
		durationSec: 0,
		tss: 0,
		intensityFactor: null,
		avgHr: null,
		...p
	};
}

function withRanges(p: Partial<Ranges>): Ranges {
	return { ...emptyRanges(), ...p };
}

describe('withinBound', () => {
	it('passes everything when no bounds are set', () => {
		expect(withinBound(5, { min: null, max: null })).toBe(true);
		expect(withinBound(null, { min: null, max: null })).toBe(true);
	});
	it('enforces an inclusive min, excluding missing values', () => {
		expect(withinBound(10, { min: 5, max: null })).toBe(true);
		expect(withinBound(5, { min: 5, max: null })).toBe(true);
		expect(withinBound(3, { min: 5, max: null })).toBe(false);
		expect(withinBound(null, { min: 5, max: null })).toBe(false);
	});
	it('enforces an inclusive max, excluding missing values', () => {
		expect(withinBound(3, { min: null, max: 5 })).toBe(true);
		expect(withinBound(5, { min: null, max: 5 })).toBe(true);
		expect(withinBound(9, { min: null, max: 5 })).toBe(false);
		expect(withinBound(null, { min: null, max: 5 })).toBe(false);
	});
});

describe('filterRows', () => {
	const rows = [
		row({
			title: 'Morning run',
			searchText: 'morning run tempo',
			sport: 'run',
			distanceDisplay: 10,
			durationSec: 3600,
			tss: 80,
			intensityFactor: 0.85,
			avgHr: 150
		}),
		row({
			title: 'Easy ride',
			searchText: 'easy ride',
			sport: 'bike',
			distanceDisplay: 40,
			durationSec: 7200,
			tss: 120,
			intensityFactor: 0.7,
			avgHr: 130
		}),
		row({
			title: 'Pool swim',
			searchText: 'pool swim',
			sport: 'swim',
			distanceDisplay: 2,
			durationSec: 1800,
			tss: 40,
			intensityFactor: null,
			avgHr: null
		})
	];
	const titles = (rs: FilterableRow[]) => rs.map((r) => r.title);

	it('filters by sport', () => {
		expect(titles(filterRows(rows, 'bike', '', emptyRanges()))).toEqual(['Easy ride']);
		expect(filterRows(rows, 'all', '', emptyRanges())).toHaveLength(3);
	});
	it('filters by search needle against searchText', () => {
		expect(titles(filterRows(rows, 'all', 'tempo', emptyRanges()))).toEqual(['Morning run']);
	});
	it('filters by distance range in display units', () => {
		expect(titles(filterRows(rows, 'all', '', withRanges({ distance: { min: 5, max: 20 } })))).toEqual([
			'Morning run'
		]);
	});
	it('filters by duration range in minutes', () => {
		// 3600s=60m, 7200s=120m, 1800s=30m → only the 120m ride is ≥ 90m
		expect(titles(filterRows(rows, 'all', '', withRanges({ duration: { min: 90, max: null } })))).toEqual(
			['Easy ride']
		);
	});
	it('filters by TSS range', () => {
		expect(titles(filterRows(rows, 'all', '', withRanges({ tss: { min: 50, max: 100 } })))).toEqual([
			'Morning run'
		]);
	});
	it('excludes rows missing the filtered metric (null IF / HR)', () => {
		expect(titles(filterRows(rows, 'all', '', withRanges({ if: { min: 0.6, max: null } })))).toEqual([
			'Morning run',
			'Easy ride'
		]);
		expect(titles(filterRows(rows, 'all', '', withRanges({ hr: { min: 100, max: null } })))).toEqual([
			'Morning run',
			'Easy ride'
		]);
	});
	it('combines sport, search and ranges', () => {
		const out = filterRows(
			rows,
			'run',
			'morning',
			withRanges({ tss: { min: 50, max: null }, hr: { min: 140, max: 160 } })
		);
		expect(titles(out)).toEqual(['Morning run']);
	});
	it('bounds against display precision, not raw precision', () => {
		// The table shows IF 0.854 as "0.85", HR 150.4 as "150", distance 13.52 as
		// "13.5". An inclusive max equal to each displayed value must keep the row,
		// even though the raw value is slightly above the bound.
		const r = row({ title: 'Sharp', intensityFactor: 0.854, avgHr: 150.4, distanceDisplay: 13.52 });
		expect(titles(filterRows([r], 'all', '', withRanges({ if: { min: null, max: 0.85 } })))).toEqual(['Sharp']);
		expect(titles(filterRows([r], 'all', '', withRanges({ hr: { min: null, max: 150 } })))).toEqual(['Sharp']);
		expect(titles(filterRows([r], 'all', '', withRanges({ distance: { min: null, max: 13.5 } })))).toEqual([
			'Sharp'
		]);
	});
});

describe('sortRows', () => {
	const rows = [
		row({ title: 'B', startTimeMs: 200, tss: 50, avgHr: 140, distanceM: 1000 }),
		row({ title: 'A', startTimeMs: 300, tss: 90, avgHr: null, distanceM: 0 }),
		row({ title: 'C', startTimeMs: 100, tss: 10, avgHr: 120, distanceM: 5000 })
	];
	const titles = (rs: FilterableRow[]) => rs.map((r) => r.title);

	it('sorts by date both directions', () => {
		expect(sortRows(rows, 'date', 'desc').map((r) => r.startTimeMs)).toEqual([300, 200, 100]);
		expect(sortRows(rows, 'date', 'asc').map((r) => r.startTimeMs)).toEqual([100, 200, 300]);
	});
	it('sorts numerically by TSS', () => {
		expect(sortRows(rows, 'tss', 'desc').map((r) => r.tss)).toEqual([90, 50, 10]);
		expect(sortRows(rows, 'tss', 'asc').map((r) => r.tss)).toEqual([10, 50, 90]);
	});
	it('sorts text by title', () => {
		expect(titles(sortRows(rows, 'title', 'asc'))).toEqual(['A', 'B', 'C']);
		expect(titles(sortRows(rows, 'title', 'desc'))).toEqual(['C', 'B', 'A']);
	});
	it('keeps missing values last regardless of direction', () => {
		// avgHr: B=140, C=120, A=null → A is always last
		expect(titles(sortRows(rows, 'hr', 'desc'))).toEqual(['B', 'C', 'A']);
		expect(titles(sortRows(rows, 'hr', 'asc'))).toEqual(['C', 'B', 'A']);
	});
	it('treats zero distance as missing and sorts it last', () => {
		// distanceM: C=5000, B=1000, A=0(missing) → A last both ways
		expect(titles(sortRows(rows, 'distance', 'desc'))).toEqual(['C', 'B', 'A']);
		expect(titles(sortRows(rows, 'distance', 'asc'))).toEqual(['B', 'C', 'A']);
	});
	it('does not mutate the input array', () => {
		const input = [...rows];
		sortRows(input, 'tss', 'desc');
		expect(titles(input)).toEqual(['B', 'A', 'C']);
	});
});

describe('activeRangeCount', () => {
	it('counts metrics with at least one bound set', () => {
		expect(activeRangeCount(emptyRanges())).toBe(0);
		expect(activeRangeCount(withRanges({ tss: { min: 10, max: null } }))).toBe(1);
		expect(
			activeRangeCount(withRanges({ tss: { min: 10, max: null }, hr: { min: null, max: 160 } }))
		).toBe(2);
	});
});
