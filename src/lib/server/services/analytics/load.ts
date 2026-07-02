import type { Sport } from '$lib/server/db/schema';

const intensityFactorBySport: Record<Sport, number> = {
	Bike: 0.6,
	Run: 0.7,
	Swim: 0.65,
	Strength: 0.5,
	Other: 0.5
};

// Defaults for users who haven't set personalised thresholds yet.
const DEFAULT_FTP = 240;
// Also the fallback LTHR anchor for HR zones when the user hasn't tested yet.
export const DEFAULT_THR_HR = 160;

export type ThresholdPrefs = {
	ftpWatts: number | null;
	thresholdHrBpm: number | null;
};

// Sport-based rough TSS from duration alone — used as the final fallback
// when neither load_score nor power/HR + thresholds are available.
export function fallbackLoadScore(input: {
	sport: Sport;
	durationSec: number | null;
}): number | null {
	if (input.durationSec === null) return null;
	const hours = input.durationSec / 3600;
	const factor = intensityFactorBySport[input.sport] ?? 0.5;
	return hours * factor * 100;
}

// Per-activity intensity factor (0..1+) using either power (bike) or HR
// (run). Honours per-user thresholds when supplied; falls back to the app
// defaults so unauthenticated/test calls keep working.
export function intensityFactorFor(
	input: {
		sport: Sport;
		avgPowerW?: number | null;
		normalizedPowerLikeW?: number | null;
		avgHr?: number | null;
	},
	prefs: ThresholdPrefs | null = null
): number | null {
	if (input.sport === 'Bike') {
		// Prefer a POSITIVE normalized-power value; a stored 0 (not null) must not
		// shadow a valid avg power via `??` and drop the ride to the duration-only
		// fallback.
		const np = input.normalizedPowerLikeW;
		const w = np && np > 0 ? np : input.avgPowerW;
		if (w && w > 0) {
			const ftp = prefs?.ftpWatts ?? DEFAULT_FTP;
			if (ftp > 0) return w / ftp;
		}
	}
	if (input.sport === 'Run' && input.avgHr && input.avgHr > 0) {
		const thr = prefs?.thresholdHrBpm ?? DEFAULT_THR_HR;
		if (thr > 0) return input.avgHr / thr;
	}
	return null;
}

// Canonical "best available TSS" for a single activity. Priority:
//   1. Stored activity.loadScore if set (Garmin precomputed)
//   2. IF-based TSS = hours * IF^2 * 100 when we have power/HR + thresholds
//   3. Sport-factor rough TSS from duration alone
export function loadFor(
	activity: {
		sport: Sport;
		durationSec: number | null;
		loadScore?: number | null;
		avgPowerW?: number | null;
		normalizedPowerLikeW?: number | null;
		avgHr?: number | null;
	},
	prefs: ThresholdPrefs | null = null
): number {
	if (activity.loadScore !== null && activity.loadScore !== undefined && activity.loadScore > 0) {
		return activity.loadScore;
	}
	if (activity.durationSec && activity.durationSec > 0) {
		const ifn = intensityFactorFor(activity, prefs);
		if (ifn !== null) {
			return (activity.durationSec / 3600) * ifn * ifn * 100;
		}
	}
	return fallbackLoadScore({ sport: activity.sport, durationSec: activity.durationSec ?? null }) ?? 0;
}
