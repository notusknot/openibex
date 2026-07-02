// LTHR field-test interpretation. Given the time-ordered HR samples of a 30-min
// time-trial (Friel protocol), the athlete's lactate-threshold HR is the average
// of the *final* 20 minutes of the effort — and because HR drifts up under
// sustained load, the hardest 20 continuous minutes of the whole recording IS
// that final 20. So we just find the best (highest-average) 20-minute window.
//
// Pure + prefs-independent so it's trivially testable; the service wrapper feeds
// it the extracted HR stream and turns the result into zone bpm ranges.

// FIT records are ~1 Hz, so one sample ≈ one second (same assumption as the HR
// histogram in streamAggregates). Segment times are therefore approximate on
// devices using smart recording.
const WINDOW_SEC = 20 * 60; // 20-minute averaging window
const MIN_TEST_SEC = 25 * 60; // most of the 30-min protocol must be present
const MAXIMAL_MARGIN_BPM = 8; // best-20 must sit this far above the session average

export type LthrTestResult = {
	hasHr: boolean;
	hrSeconds: number; // total HR samples (≈ seconds of HR data)
	lthr: number | null; // rounded bpm; null when < 20 min of HR was recorded
	segmentStartSec: number; // start of the best 20-min window (≈ seconds from HR start)
	segmentEndSec: number;
	looksMaximal: boolean; // heuristic: enough data AND a clear hard block
};

/**
 * Detect LTHR from the ordered HR samples of a field test. `hrSamples` is the
 * per-record heart rate in recording order (non-positive/invalid entries are
 * dropped). Returns `lthr: null` when there isn't a full 20-minute window.
 */
export function interpretLthrTest(hrSamples: number[]): LthrTestResult {
	const samples = hrSamples.filter((h) => Number.isFinite(h) && h > 0);
	const n = samples.length;
	const base: LthrTestResult = {
		hasHr: n > 0,
		hrSeconds: n,
		lthr: null,
		segmentStartSec: 0,
		segmentEndSec: 0,
		looksMaximal: false
	};
	if (n < WINDOW_SEC) return base;

	// Best 20-min average and where it starts — O(n) sliding sum, ties keep the
	// earliest window (strict `>`), matching "final 20 of the effort".
	let sum = 0;
	for (let i = 0; i < WINDOW_SEC; i++) sum += samples[i]!;
	let bestSum = sum;
	let bestStart = 0;
	for (let i = WINDOW_SEC; i < n; i++) {
		sum += samples[i]! - samples[i - WINDOW_SEC]!;
		if (sum > bestSum) {
			bestSum = sum;
			bestStart = i - WINDOW_SEC + 1;
		}
	}
	const bestAvg = bestSum / WINDOW_SEC;
	const overallAvg = samples.reduce((a, b) => a + b, 0) / n;

	return {
		hasHr: true,
		hrSeconds: n,
		lthr: Math.round(bestAvg),
		segmentStartSec: bestStart,
		segmentEndSec: bestStart + WINDOW_SEC,
		// ponytail: soft heuristic, not a hard verdict. Enough of the protocol present
		// AND the hard block clearly above the session average (which the warmup +
		// cooldown pull down). Can't prove "maximal" without a known max HR, so this
		// drives a warning, not a block. Tune MAXIMAL_MARGIN_BPM if it mis-flags.
		looksMaximal: n >= MIN_TEST_SEC && bestAvg - overallAvg >= MAXIMAL_MARGIN_BPM
	};
}
