import { describe, expect, it } from 'vitest';

import {
	BAR_BASE_Y,
	BAR_CAP_W,
	BAR_INNER_H,
	BAR_PAD_L,
	BAR_W,
	computeBarGeo,
	computePmcGeo,
	PMC_INNER_H,
	PMC_PAD_L,
	PMC_PAD_T,
	PMC_W
} from './chartGeometry';

const DAY = 24 * 60 * 60 * 1000;
const pt = (i: number, ctl: number, atl: number) => ({
	dateMs: Date.UTC(2026, 0, 1) + i * DAY,
	ctl,
	atl,
	tsb: ctl - atl
});

describe('computePmcGeo', () => {
	it('empty series falls back to a sane default range with a full grid', () => {
		const g = computePmcGeo([]);
		expect(g.n).toBe(1);
		expect(g.gridLines).toHaveLength(5);
		expect(g.xLabels).toHaveLength(0); // no x labels for a single/empty series
		// Default range is [-2,2] padded to [-4,4]; grid spans it top to bottom.
		expect(g.gridLines[0]?.label).toBe(-4);
		expect(g.gridLines[4]?.label).toBe(4);
	});

	it('maps the series linearly into the padded viewBox', () => {
		const vals = [pt(0, 10, 20), pt(1, 15, 15), pt(2, 20, 10)];
		const g = computePmcGeo(vals);
		expect(g.n).toBe(3);
		// X: first point at left pad, last at right edge of the inner width.
		expect(g.X(0)).toBeCloseTo(PMC_PAD_L, 5);
		expect(g.X(2)).toBeCloseTo(PMC_W - PMC_PAD_L, 5);
		// Y is inverted (bigger value → smaller y) and spans the inner height
		// between the padded min/max.
		const mn = Math.floor(-10) - 2; // min tsb = -10
		const mx = Math.ceil(20) + 2; // max ctl/atl = 20
		expect(g.Y(mx)).toBeCloseTo(PMC_PAD_T, 5);
		expect(g.Y(mn)).toBeCloseTo(PMC_PAD_T + PMC_INNER_H, 5);
		expect(g.Y(10)).toBeLessThan(g.Y(0));
	});

	it('emits one polyline point per sample and closes the form area on the zero line', () => {
		const vals = [pt(0, 10, 20), pt(1, 15, 15), pt(2, 20, 10)];
		const g = computePmcGeo(vals);
		expect(g.fitnessPts.split(' ')).toHaveLength(3);
		expect(g.fatiguePts.split(' ')).toHaveLength(3);
		expect(g.formPts.split(' ')).toHaveLength(3);
		// formArea = leading zero-line anchor + the tsb points + trailing anchor.
		const area = g.formArea.split(' ');
		expect(area).toHaveLength(5);
		expect(area[0]).toBe(`${PMC_PAD_L},${g.zeroY}`);
		expect(area[4]).toBe(`${g.X(2).toFixed(1)},${g.zeroY}`);
	});

	it('flat series (mn === mx) still renders with a non-degenerate range', () => {
		const g = computePmcGeo([pt(0, 0, 0), pt(1, 0, 0)]);
		// All values 0 → falls back to [-2,2] padded to [-4,4]: zero line centered.
		expect(parseFloat(g.zeroY)).toBeCloseTo(PMC_PAD_T + PMC_INNER_H / 2, 1);
		expect(g.xLabels.length).toBeGreaterThan(0);
	});
});

describe('computeBarGeo', () => {
	it('returns no bars for no weeks', () => {
		expect(computeBarGeo([])).toEqual([]);
	});

	it('all-zero totals produce zero-height bars sitting on the baseline', () => {
		const bars = computeBarGeo([
			{ label: 'w1', total: 0, swim: 0, bike: 0, run: 0 },
			{ label: 'w2', total: 0, swim: 0, bike: 0, run: 0 }
		]);
		for (const b of bars) {
			expect(b.runH + b.bikeH + b.swimH).toBe(0);
			expect(b.runY).toBeCloseTo(BAR_BASE_Y, 1);
		}
	});

	it('stacks run → bike → swim from the baseline, scaled to the max week', () => {
		const bars = computeBarGeo([
			{ label: 'big', total: 100, swim: 20, bike: 30, run: 50 },
			{ label: 'half', total: 50, swim: 0, bike: 25, run: 25 }
		]);
		const big = bars[0]!;
		// The max week fills the full inner height, split by sport share.
		expect(big.runH + big.bikeH + big.swimH).toBeCloseTo(BAR_INNER_H, 0);
		expect(big.runH).toBeCloseTo(0.5 * BAR_INNER_H, 0);
		// Stack: run sits on the baseline, bike on run, swim on bike.
		expect(big.runY + big.runH).toBeCloseTo(BAR_BASE_Y, 0);
		expect(big.bikeY + big.bikeH).toBeCloseTo(big.runY, 0);
		expect(big.swimY + big.swimH).toBeCloseTo(big.bikeY, 0);
		// The half-size week is half as tall.
		const half = bars[1]!;
		expect(half.runH + half.bikeH + half.swimH).toBeCloseTo(BAR_INNER_H / 2, 0);
	});

	it('caps bar width and keeps bars inside the padded viewBox', () => {
		const weeks = Array.from({ length: 12 }, (_, i) => ({
			label: `w${i}`,
			total: 10,
			swim: 0,
			bike: 5,
			run: 5
		}));
		const bars = computeBarGeo(weeks);
		for (const b of bars) {
			expect(b.barW).toBeLessThanOrEqual(BAR_CAP_W);
			expect(b.x).toBeGreaterThanOrEqual(BAR_PAD_L);
			expect(b.x + b.barW).toBeLessThanOrEqual(BAR_W - BAR_PAD_L + 0.1);
		}
	});
});
