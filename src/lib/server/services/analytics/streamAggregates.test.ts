import { describe, expect, it } from 'vitest';
import {
	STREAM_METRICS_VERSION,
	addHistogramZoneSeconds,
	bestRollingAverage,
	computeActivityStreamMetrics,
	maxBpmInHistogram
} from './streamAggregates';

describe('bestRollingAverage', () => {
	it('finds the best window average', () => {
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
		expect(bestRollingAverage([200, 0, 200, 0], 2)).toBe(100);
	});
});

describe('computeActivityStreamMetrics', () => {
	it('builds an HR histogram (seconds per bpm) and a power curve', () => {
		const records = [
			...Array.from({ length: 600 }, () => ({ heart_rate: 150, power: 200 })),
			...Array.from({ length: 400 }, () => ({ heart_rate: 130, power: 200 }))
		];
		const m = computeActivityStreamMetrics({ records });
		expect(m.version).toBe(STREAM_METRICS_VERSION);
		expect(m.hrHistogram).toEqual({ '150': 600, '130': 400 });
		// constant 200 W → best avg = 200 at every available duration
		expect(m.powerCurve?.['5']).toBe(200);
		expect(m.powerCurve?.['300']).toBe(200);
		// 1000 samples < 1200 → no 20-min point
		expect(m.powerCurve?.['1200']).toBeUndefined();
	});

	it('returns null channels when HR / power are absent', () => {
		const m = computeActivityStreamMetrics({ records: [{ cadence: 90 }, { cadence: 91 }] });
		expect(m.hrHistogram).toBeNull();
		expect(m.powerCurve).toBeNull();
	});

	it('tolerates a missing/garbage stream', () => {
		expect(computeActivityStreamMetrics(null).hrHistogram).toBeNull();
		expect(computeActivityStreamMetrics({}).powerCurve).toBeNull();
	});
});

describe('addHistogramZoneSeconds', () => {
	it('buckets bpm against max HR and accumulates in place', () => {
		// maxRef 200 → zone bounds at 120/140/160/180 bpm.
		const into = [0, 0, 0, 0, 0];
		addHistogramZoneSeconds(into, { '100': 1, '130': 1, '150': 1, '170': 1, '190': 1 }, 200);
		expect(into).toEqual([1, 1, 1, 1, 1]);
		addHistogramZoneSeconds(into, { '130': 9 }, 200); // Z2
		expect(into).toEqual([1, 10, 1, 1, 1]);
	});

	it('is a no-op when the reference is not positive', () => {
		const into = [0, 0, 0, 0, 0];
		addHistogramZoneSeconds(into, { '150': 5 }, 0);
		expect(into).toEqual([0, 0, 0, 0, 0]);
	});
});

describe('maxBpmInHistogram', () => {
	it('returns the highest bpm key', () => {
		expect(maxBpmInHistogram({ '120': 3, '165': 10, '90': 2 })).toBe(165);
	});
	it('returns 0 for an empty histogram', () => {
		expect(maxBpmInHistogram({})).toBe(0);
	});
});
