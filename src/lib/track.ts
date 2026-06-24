// Pure, dependency-free track geometry helpers. Isomorphic: the server uses
// `simplifyTrack` to thin a GPS stream before sending it to the client, and the
// client uses `nearestIndex` for map-hover hit-testing. Keep this file free of
// any SvelteKit / Node / DOM imports so it stays trivially unit-testable.

export type XY = { x: number; y: number };

// One per-point sample of an activity, shared by the route map and the
// time-series charts. Any metric may be null on a given point (no GPS lock, no
// HR strap). `t` is seconds from the activity start and is the chart x-axis.
// Defined here (not in a `$lib/server` module) so client components can import
// the type without pulling in server-only code.
export type TrackPoint = {
	t: number;
	lat: number | null;
	lng: number | null;
	hr: number | null;
	pace: number | null; // sec/km
	power: number | null; // watts
	elevation: number | null; // meters
	distance: number | null; // cumulative meters
};

export type ActivityTrackMetrics = {
	hr: boolean;
	pace: boolean;
	power: boolean;
	elevation: boolean;
};

export type TrackBounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export type ActivityTrack = {
	hasGps: boolean;
	points: TrackPoint[];
	bounds: TrackBounds | null;
	metrics: ActivityTrackMetrics;
	maxHrRef: number | null; // max-HR basis for client-side HR-zone coloring
	units: 'metric' | 'imperial'; // for client-side elevation readouts
	durationSec: number;
	distanceLabel: string;
	elevationLabel: string;
};

const EARTH_RADIUS_M = 6_371_000;
const DEG = Math.PI / 180;

/**
 * Equirectangular (plate carrée) projection to local meters, anchored at
 * (lat0, lng0). Good enough at activity scale and cheap: longitude is scaled by
 * cos(lat0) so x/y share one metric unit and the track isn't horizontally
 * stretched. Used both to feed Douglas–Peucker (epsilon in meters) and, on the
 * client, to lay the track out in the SVG viewport.
 */
export function projectEquirectangular(lat: number, lng: number, lat0: number, lng0: number): XY {
	return {
		x: EARTH_RADIUS_M * (lng - lng0) * DEG * Math.cos(lat0 * DEG),
		y: EARTH_RADIUS_M * (lat - lat0) * DEG
	};
}

// Perpendicular distance from point `p` to the infinite line through `a`–`b`
// (the classic Douglas–Peucker distance). Falls back to point distance when the
// segment is degenerate (a === b).
function perpendicularDistance(p: XY, a: XY, b: XY): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const segLen2 = dx * dx + dy * dy;
	if (segLen2 === 0) {
		const px = p.x - a.x;
		const py = p.y - a.y;
		return Math.sqrt(px * px + py * py);
	}
	const cross = Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy);
	return cross / Math.sqrt(segLen2);
}

/**
 * Douglas–Peucker line simplification. Returns the sorted indices of the points
 * to keep (always including the first and last). Iterative with an explicit
 * stack so a long, jittery track can't blow the call stack. A larger `epsilon`
 * (in the same units as the points — meters, here) keeps fewer points.
 */
export function douglasPeucker(pts: XY[], epsilon: number): number[] {
	const n = pts.length;
	if (n <= 2) return pts.map((_, i) => i);

	const keep = new Uint8Array(n);
	keep[0] = 1;
	keep[n - 1] = 1;

	const stack: Array<[number, number]> = [[0, n - 1]];
	while (stack.length > 0) {
		const [start, end] = stack.pop()!;
		let maxDist = -1;
		let maxIdx = -1;
		for (let i = start + 1; i < end; i++) {
			const d = perpendicularDistance(pts[i]!, pts[start]!, pts[end]!);
			if (d > maxDist) {
				maxDist = d;
				maxIdx = i;
			}
		}
		if (maxDist > epsilon && maxIdx !== -1) {
			keep[maxIdx] = 1;
			stack.push([start, maxIdx]);
			stack.push([maxIdx, end]);
		}
	}

	const out: number[] = [];
	for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
	return out;
}

/**
 * Simplify a list of arbitrary items by their projected (x, y) position,
 * carrying the whole item through — so per-point metrics (HR, elevation, …)
 * stay aligned to the surviving geometry. Thin wrapper over `douglasPeucker`.
 */
export function simplifyTrack<T>(items: T[], getXY: (item: T) => XY, epsilon: number): T[] {
	if (items.length <= 2) return items.slice();
	const idx = douglasPeucker(items.map(getXY), epsilon);
	return idx.map((i) => items[i]!);
}

/**
 * Index of the point nearest to (x, y) by squared Euclidean distance. Linear
 * scan — fine on a simplified track of a few hundred points. Ties resolve to the
 * lower index (strict `<`). Returns -1 for an empty list.
 */
export function nearestIndex(pts: XY[], x: number, y: number): number {
	let best = -1;
	let bestD = Infinity;
	for (let i = 0; i < pts.length; i++) {
		const dx = pts[i]!.x - x;
		const dy = pts[i]!.y - y;
		const d = dx * dx + dy * dy;
		if (d < bestD) {
			bestD = d;
			best = i;
		}
	}
	return best;
}
