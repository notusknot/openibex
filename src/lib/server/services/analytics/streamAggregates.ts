import { hrZoneIndex } from '$lib/zones';

// Pure stream-aggregation helpers behind the dashboard's "Time in zone" and
// "Power profile" cards. FIT records are ~1 Hz, so one record ≈ one second —
// counting samples therefore approximates seconds. The per-activity metrics
// computed here (`computeActivityStreamMetrics`) are stored once at import (see
// the `activity_stream_metrics` table) and summed cheaply at read time, so the
// dashboard never re-parses stream blobs.

// Bump when the metric computation changes shape/meaning; rows with an older
// version are recomputed lazily on read and by the backfill CLI.
export const STREAM_METRICS_VERSION = 1;

// Canonical mean-maximal-power durations (seconds). Richer than the dashboard's
// five points so a future power-duration-curve chart already has the data.
export const POWER_CURVE_DURATIONS = [1, 5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600] as const;

// seconds-per-integer-bpm, e.g. { "150": 600 }. FIT heart_rate is an integer
// field, so integer-bpm bins are lossless.
export type HrHistogram = Record<string, number>;
// best mean-maximal watts per duration (seconds), e.g. { "5": 800, "60": 410 }.
export type PowerCurve = Record<string, number>;

export type ActivityStreamMetrics = {
	version: number;
	hrHistogram: HrHistogram | null; // null when the activity recorded no HR
	powerCurve: PowerCurve | null; // null when the activity recorded no power
};

function asFiniteNumber(v: unknown): number | null {
	if (v === null || v === undefined) return null;
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}

function extractRecords(stream: unknown): Array<Record<string, unknown>> {
	if (!stream || typeof stream !== 'object') return [];
	const recs = (stream as { records?: unknown }).records;
	return Array.isArray(recs) ? (recs as Array<Record<string, unknown>>) : [];
}

/**
 * Best average over any window of `windowSamples` consecutive samples — the
 * mean-maximal value used to build a power-duration curve. O(n) sliding window.
 * Returns null when there are fewer samples than the window length.
 */
export function bestRollingAverage(samples: number[], windowSamples: number): number | null {
	const n = samples.length;
	if (windowSamples <= 0 || n < windowSamples) return null;
	let sum = 0;
	for (let i = 0; i < windowSamples; i++) sum += samples[i]!;
	let best = sum;
	for (let i = windowSamples; i < n; i++) {
		sum += samples[i]! - samples[i - windowSamples]!;
		if (sum > best) best = sum;
	}
	return best / windowSamples;
}

/**
 * Reduce one activity's raw FIT stream (`{ records, laps }`) to its durable,
 * prefs-independent metrics: an HR histogram (seconds per integer bpm) and a
 * mean-maximal power curve. Both null when the corresponding channel is absent.
 */
export function computeActivityStreamMetrics(stream: unknown): ActivityStreamMetrics {
	const records = extractRecords(stream);

	const hr = new Map<number, number>();
	const powerSamples: number[] = [];
	for (const r of records) {
		const h = asFiniteNumber(r['heart_rate'] ?? r['heartRate']);
		if (h !== null && h > 0) {
			const bpm = Math.round(h);
			hr.set(bpm, (hr.get(bpm) ?? 0) + 1);
		}
		const p = asFiniteNumber(r['power']);
		if (p !== null && p >= 0) powerSamples.push(p);
	}

	let hrHistogram: HrHistogram | null = null;
	if (hr.size > 0) {
		hrHistogram = {};
		for (const [bpm, sec] of hr) hrHistogram[String(bpm)] = sec;
	}

	let powerCurve: PowerCurve | null = null;
	if (powerSamples.length > 0) {
		const curve: PowerCurve = {};
		for (const d of POWER_CURVE_DURATIONS) {
			const best = bestRollingAverage(powerSamples, d);
			if (best !== null) curve[String(d)] = Math.round(best);
		}
		if (Object.keys(curve).length > 0) powerCurve = curve;
	}

	return { version: STREAM_METRICS_VERSION, hrHistogram, powerCurve };
}

/** Highest bpm present in a histogram (≈ the activity's max HR sample). */
export function maxBpmInHistogram(hist: HrHistogram): number {
	let max = 0;
	for (const bpm of Object.keys(hist)) {
		const n = Number(bpm);
		if (Number.isFinite(n) && n > max) max = n;
	}
	return max;
}

/**
 * Add one activity's HR histogram into a 5-bucket Z1–Z5 seconds accumulator
 * (mutated in place), bucketing each bpm against the athlete's `lthr`. No-op
 * when the reference is not positive.
 */
export function addHistogramZoneSeconds(into: number[], hist: HrHistogram, lthr: number): void {
	if (!(lthr > 0)) return;
	for (const [bpmStr, sec] of Object.entries(hist)) {
		const bpm = Number(bpmStr);
		if (!Number.isFinite(bpm) || bpm <= 0) continue;
		into[hrZoneIndex(bpm, lthr)]! += sec;
	}
}

/** Serialize computed metrics into the row shape stored by the repository. */
export function serializeStreamMetrics(m: ActivityStreamMetrics): {
	version: number;
	hrHistogramJson: string | null;
	powerCurveJson: string | null;
} {
	return {
		version: m.version,
		hrHistogramJson: m.hrHistogram ? JSON.stringify(m.hrHistogram) : null,
		powerCurveJson: m.powerCurve ? JSON.stringify(m.powerCurve) : null
	};
}
