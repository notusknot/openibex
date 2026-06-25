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

// Lower bound of each zone as a fraction of max HR.
export const HR_ZONE_THRESHOLD_PCT = [0, 0.6, 0.7, 0.8, 0.9] as const;

/** Zone bucket (0–4) for a heart-rate sample given a max-HR reference. */
export function hrZoneIndex(hr: number, maxRef: number): number {
	if (!Number.isFinite(hr) || hr <= 0 || !Number.isFinite(maxRef) || maxRef <= 0) return 0;
	const pct = hr / maxRef;
	for (let z = HR_ZONE_THRESHOLD_PCT.length - 1; z >= 0; z--) {
		if (pct >= HR_ZONE_THRESHOLD_PCT[z]!) return z;
	}
	return 0;
}
