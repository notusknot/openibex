import { describe, expect, it } from 'vitest';
import { addHrZoneSeconds, bestRollingAverage } from './streamAggregates';

describe('addHrZoneSeconds', () => {
	it('buckets samples by fraction of max HR (thresholds 0/.6/.7/.8/.9)', () => {
		const into = [0, 0, 0, 0, 0];
		// maxRef 200 → zone bounds at 120/140/160/180 bpm.
		addHrZoneSeconds(into, [100, 130, 150, 170, 190], 200);
		expect(into).toEqual([1, 1, 1, 1, 1]); // Z1..Z5, one each
	});

	it('accumulates across calls and skips non-positive samples', () => {
		const into = [0, 0, 0, 0, 0];
		addHrZoneSeconds(into, [130, 130, 0, -5, NaN], 200); // 130 → Z2
		addHrZoneSeconds(into, [130], 200);
		expect(into).toEqual([0, 3, 0, 0, 0]);
	});

	it('is a no-op when the max-HR reference is not positive', () => {
		const into = [0, 0, 0, 0, 0];
		addHrZoneSeconds(into, [150, 160], 0);
		expect(into).toEqual([0, 0, 0, 0, 0]);
	});
});

describe('bestRollingAverage', () => {
	it('finds the best window average', () => {
		// best 3-sample window is [9,10,11] → 10.
		expect(bestRollingAverage([1, 2, 3, 9, 10, 11, 4], 3)).toBe(10);
	});

	it('handles a window equal to the sample count', () => {
		expect(bestRollingAverage([2, 4, 6], 3)).toBe(4);
	});

	it('returns null when there are fewer samples than the window', () => {
		expect(bestRollingAverage([1, 2], 3)).toBeNull();
		expect(bestRollingAverage([], 1)).toBeNull();
	});

	it('returns null for a non-positive window', () => {
		expect(bestRollingAverage([1, 2, 3], 0)).toBeNull();
	});

	it('counts coasting zeros against the average (does not drop them)', () => {
		// [200,0,200,0] best 2-window average is 100, not 200.
		expect(bestRollingAverage([200, 0, 200, 0], 2)).toBe(100);
	});
});
