import { describe, expect, it } from 'vitest';

import { douglasPeucker, movingTimeIndices, nearestIndex, simplifyTrack, type XY } from '$lib/track';

const p = (x: number, y: number): XY => ({ x, y });

describe('douglasPeucker', () => {
	it('reduces a collinear run to its endpoints', () => {
		const pts = [p(0, 0), p(1, 1), p(2, 2), p(3, 3), p(4, 4)];
		expect(douglasPeucker(pts, 0.01)).toEqual([0, 4]);
	});

	it('keeps a spike that exceeds epsilon', () => {
		// Middle point sits 5 units off the (0,0)->(2,0) baseline.
		const pts = [p(0, 0), p(1, 5), p(2, 0)];
		expect(douglasPeucker(pts, 0.1)).toEqual([0, 1, 2]);
	});

	it('drops a wobble smaller than epsilon', () => {
		// Middle point only 0.001 off the baseline — below a 0.1 tolerance.
		const pts = [p(0, 0), p(1, 0.001), p(2, 0)];
		expect(douglasPeucker(pts, 0.1)).toEqual([0, 2]);
	});

	it('keeps fewer points as epsilon grows', () => {
		const pts = [p(0, 0), p(1, 1), p(2, 0), p(3, 1), p(4, 0)];
		const tight = douglasPeucker(pts, 0.1);
		const loose = douglasPeucker(pts, 2);
		expect(tight.length).toBeGreaterThan(loose.length);
		expect(loose).toEqual([0, 4]); // only endpoints survive a coarse tolerance
	});

	it('always retains the first and last index', () => {
		const pts = [p(0, 0), p(10, 0.0001), p(20, 0)];
		const kept = douglasPeucker(pts, 1);
		expect(kept[0]).toBe(0);
		expect(kept[kept.length - 1]).toBe(2);
	});

	it('handles empty, single, and two-point inputs', () => {
		expect(douglasPeucker([], 1)).toEqual([]);
		expect(douglasPeucker([p(0, 0)], 1)).toEqual([0]);
		expect(douglasPeucker([p(0, 0), p(5, 5)], 1)).toEqual([0, 1]);
	});
});

describe('simplifyTrack', () => {
	it('carries the full item (metrics included) through, keyed off projected xy', () => {
		const items = [
			{ x: 0, y: 0, hr: 120 },
			{ x: 1, y: 1, hr: 130 }, // collinear — dropped
			{ x: 2, y: 2, hr: 140 }
		];
		const out = simplifyTrack(items, (it) => ({ x: it.x, y: it.y }), 0.01);
		expect(out).toEqual([
			{ x: 0, y: 0, hr: 120 },
			{ x: 2, y: 2, hr: 140 }
		]);
	});
});

describe('movingTimeIndices', () => {
	const tm = (...vals: number[]) => vals.map((tMoving) => ({ tMoving }));

	it('keeps every index when moving time strictly increases', () => {
		expect(movingTimeIndices(tm(0, 1, 2, 3, 4))).toEqual([0, 1, 2, 3, 4]);
	});

	it('drops a paused range where the timer stalls', () => {
		// timer holds at 3 across a pause (samples 4..6), then resumes.
		expect(movingTimeIndices(tm(0, 1, 2, 3, 3, 3, 3, 4, 5))).toEqual([0, 1, 2, 3, 7, 8]);
	});

	it('always keeps the first index, even at a stall boundary', () => {
		expect(movingTimeIndices(tm(10, 10, 11))).toEqual([0, 2]);
	});

	it('handles empty and single-point inputs', () => {
		expect(movingTimeIndices([])).toEqual([]);
		expect(movingTimeIndices(tm(42))).toEqual([0]);
	});
});

describe('nearestIndex', () => {
	it('returns the index of the closest point', () => {
		const pts = [p(0, 0), p(10, 0), p(20, 0)];
		expect(nearestIndex(pts, 9, 1)).toBe(1);
		expect(nearestIndex(pts, 19, -2)).toBe(2);
		expect(nearestIndex(pts, -3, 0)).toBe(0);
	});

	it('handles a single point', () => {
		expect(nearestIndex([p(5, 5)], 100, 100)).toBe(0);
	});

	it('resolves ties to the lower index', () => {
		const pts = [p(0, 0), p(2, 0)];
		expect(nearestIndex(pts, 1, 0)).toBe(0); // equidistant -> first
	});

	it('returns -1 for an empty list', () => {
		expect(nearestIndex([], 0, 0)).toBe(-1);
	});
});
