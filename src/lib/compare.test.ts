import { describe, expect, it } from 'vitest';

import { buildSeries, commonMetrics, hasDistanceAxis, sharedDomain } from '$lib/compare';
import type { TrackPoint, ActivityTrackMetrics } from '$lib/track';

// Minimal TrackPoint factory — only the fields a test cares about; the rest
// default to null (no GPS / no metric on that sample).
function pt(over: Partial<TrackPoint>): TrackPoint {
	return {
		t: 0,
		tMoving: 0,
		lat: null,
		lng: null,
		hr: null,
		pace: null,
		power: null,
		elevation: null,
		distance: null,
		...over
	};
}

const metrics = (over: Partial<ActivityTrackMetrics>): ActivityTrackMetrics => ({
	hr: false,
	pace: false,
	power: false,
	elevation: false,
	...over
});

describe('buildSeries', () => {
	it('plots the chosen metric against moving time', () => {
		const pts = [
			pt({ tMoving: 0, hr: 120 }),
			pt({ tMoving: 10, hr: 130 }),
			pt({ tMoving: 20, hr: 140 })
		];
		expect(buildSeries(pts, 'hr', 'time')).toEqual([
			{ x: 0, y: 120 },
			{ x: 10, y: 130 },
			{ x: 20, y: 140 }
		]);
	});

	it('plots against cumulative distance on the distance axis', () => {
		const pts = [pt({ distance: 0, pace: 300 }), pt({ distance: 1000, pace: 290 })];
		expect(buildSeries(pts, 'pace', 'distance')).toEqual([
			{ x: 0, y: 300 },
			{ x: 1000, y: 290 }
		]);
	});

	it('drops points missing the metric or the axis value', () => {
		const pts = [
			pt({ tMoving: 0, hr: 120 }),
			pt({ tMoving: 10, hr: null }), // no HR sample
			pt({ tMoving: 20, hr: 140 })
		];
		expect(buildSeries(pts, 'hr', 'time')).toEqual([
			{ x: 0, y: 120 },
			{ x: 20, y: 140 }
		]);
		// Distance axis: points with null distance fall out.
		expect(buildSeries(pts, 'hr', 'distance')).toEqual([]);
	});
});

describe('sharedDomain', () => {
	it('spans both series on each axis', () => {
		const a = [
			{ x: 0, y: 100 },
			{ x: 50, y: 150 }
		];
		const b = [
			{ x: 0, y: 120 },
			{ x: 80, y: 140 }
		];
		expect(sharedDomain(a, b)).toEqual({ xMin: 0, xMax: 80, yMin: 100, yMax: 150 });
	});

	it('widens a flat (zero-span) range so the renderer never divides by zero', () => {
		const flat = [
			{ x: 5, y: 7 },
			{ x: 5, y: 7 }
		];
		expect(sharedDomain(flat, flat)).toEqual({ xMin: 5, xMax: 6, yMin: 7, yMax: 8 });
	});

	it('falls back to a unit box when both series are empty', () => {
		expect(sharedDomain([], [])).toEqual({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 });
	});
});

describe('commonMetrics', () => {
	it('returns only metrics present on both activities', () => {
		const run = metrics({ hr: true, pace: true, elevation: true });
		const bike = metrics({ hr: true, power: true, elevation: true });
		// Power is bike-only, pace is run-only — neither is shared.
		expect(commonMetrics(run, bike)).toEqual(['hr', 'elevation']);
	});

	it('returns an empty list when nothing overlaps', () => {
		expect(commonMetrics(metrics({ pace: true }), metrics({ power: true }))).toEqual([]);
	});
});

describe('hasDistanceAxis', () => {
	it('is true only when both tracks carry a distance stream', () => {
		const withDist = [pt({ distance: 0 }), pt({ distance: 100 })];
		const noDist = [pt({ hr: 120 })];
		expect(hasDistanceAxis(withDist, withDist)).toBe(true);
		expect(hasDistanceAxis(withDist, noDist)).toBe(false);
	});
});
