import { hrZoneIndex } from '$lib/zones';

// Pure stream-aggregation helpers shared by the dashboard's "Time in zone" and
// "Power profile" cards. FIT records are ~1 Hz, so one record ≈ one second —
// counting samples therefore approximates seconds (the same assumption the
// per-activity zone histogram in activityDetailService makes).

/**
 * Accumulate one activity's heart-rate samples into a 5-bucket Z1–Z5 seconds
 * array (mutated in place). `maxHrRef` is the reference max HR the zone
 * thresholds are a fraction of. Non-positive / non-finite samples are skipped.
 */
export function addHrZoneSeconds(into: number[], hrSamples: number[], maxHrRef: number): void {
	if (!(maxHrRef > 0)) return;
	for (const hr of hrSamples) {
		if (!Number.isFinite(hr) || hr <= 0) continue;
		into[hrZoneIndex(hr, maxHrRef)]! += 1;
	}
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
