// Single source of truth for the Z1–Z5 heart-rate zone palette + thresholds,
// shared by the dashboard time-in-zone bar, the activity-detail zone card, and
// the route map's HR-zone coloring. Keep dependency-free (imported on client too).

export const HR_ZONE_NAMES = [
	'Z1 · Recovery',
	'Z2 · Endurance',
	'Z3 · Tempo',
	'Z4 · Threshold',
	'Z5 · VO₂'
] as const;

export const HR_ZONE_COLORS = ['#9fc2a8', '#3c7a53', '#d2a03a', '#c0892e', '#9a4b2e'] as const;

// Lower bound of each zone as a fraction of LTHR (lactate-threshold HR), per
// Friel. 100% LTHR sits exactly on the Z4/Z5 boundary — the physiologically
// meaningful cut. Anchored on the user's measured `thresholdHrBpm`, not max HR.
export const HR_ZONE_THRESHOLD_PCT = [0, 0.85, 0.9, 0.95, 1.0] as const;

/** Zone bucket (0–4) for a heart-rate sample given an LTHR reference. */
export function hrZoneIndex(hr: number, lthr: number): number {
	if (!Number.isFinite(hr) || hr <= 0 || !Number.isFinite(lthr) || lthr <= 0) return 0;
	const pct = hr / lthr;
	for (let z = HR_ZONE_THRESHOLD_PCT.length - 1; z >= 0; z--) {
		if (pct >= HR_ZONE_THRESHOLD_PCT[z]!) return z;
	}
	return 0;
}
