// Pure, dependency-free helpers for the activity-comparison overlay. Like
// `$lib/track`, this stays free of SvelteKit / Node / DOM imports so it is
// trivially unit-testable and safe to import from the client chart component.

import type { TrackPoint, ActivityTrackMetrics, XY } from '$lib/track';

// Metrics we can overlay. Each maps 1:1 onto a nullable TrackPoint field.
export type CompareMetric = 'hr' | 'pace' | 'power' | 'elevation';
// The x-axis to align the two activities on.
export type CompareAxis = 'time' | 'distance';

export type CompareDomain = { xMin: number; xMax: number; yMin: number; yMax: number };

/**
 * Turn a track into an (x, y) series for one metric on one axis, dropping any
 * point missing either coordinate so the line breaks cleanly rather than
 * collapsing to zero. Points stay in recorded order. The time axis uses moving
 * seconds (pauses excluded, the Strava/intervals look); distance is cumulative
 * meters.
 */
export function buildSeries(points: TrackPoint[], metric: CompareMetric, axis: CompareAxis): XY[] {
	const out: XY[] = [];
	for (const p of points) {
		const x = axis === 'time' ? p.tMoving : p.distance;
		const y = p[metric];
		if (x === null || y === null) continue;
		out.push({ x, y });
	}
	return out;
}

/**
 * Combined domain over BOTH series so the two activities are drawn on one shared
 * pair of axes and are directly comparable. Collapses degenerate (zero-span)
 * ranges to width 1 so the renderer never divides by zero.
 */
export function sharedDomain(a: XY[], b: XY[]): CompareDomain {
	let xMin = Infinity;
	let xMax = -Infinity;
	let yMin = Infinity;
	let yMax = -Infinity;
	for (const series of [a, b]) {
		for (const p of series) {
			if (p.x < xMin) xMin = p.x;
			if (p.x > xMax) xMax = p.x;
			if (p.y < yMin) yMin = p.y;
			if (p.y > yMax) yMax = p.y;
		}
	}
	if (!Number.isFinite(xMin)) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
	if (xMax === xMin) xMax = xMin + 1;
	if (yMax === yMin) yMax = yMin + 1;
	return { xMin, xMax, yMin, yMax };
}

/** Metrics present on BOTH activities — so e.g. a Power toggle only shows when
 * each side actually has power. */
export function commonMetrics(a: ActivityTrackMetrics, b: ActivityTrackMetrics): CompareMetric[] {
	const all: CompareMetric[] = ['hr', 'pace', 'power', 'elevation'];
	return all.filter((m) => a[m] && b[m]);
}

/** Whether a distance-aligned x-axis is meaningful — both tracks must carry a
 * distance stream. */
export function hasDistanceAxis(a: TrackPoint[], b: TrackPoint[]): boolean {
	return a.some((p) => p.distance !== null) && b.some((p) => p.distance !== null);
}
