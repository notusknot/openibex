// Wraps the pure LTHR interpreter: verifies the activity belongs to the user,
// loads its HR stream, detects LTHR, and turns it into the Z1–Z5 bpm table the
// settings wizard shows before the athlete saves.

import { getActivityByIdForUser } from '$lib/server/repositories/activitiesRepository';
import { readStreamBlob } from '$lib/server/services/fileStorageService';
import { interpretLthrTest, type LthrTestResult } from '$lib/server/services/analytics/lthrTest';
import { HR_ZONE_COLORS, HR_ZONE_NAMES, HR_ZONE_THRESHOLD_PCT } from '$lib/zones';

export type LthrZoneRow = { name: string; range: string; color: string };

export type LthrTestInterpretation = LthrTestResult & {
	activityId: string;
	activityTitle: string;
	segmentLabel: string | null; // "5:00–25:00" of the recording, null when no LTHR
	zones: LthrZoneRow[]; // empty when no LTHR could be computed
};

function mmss(sec: number): string {
	const m = Math.floor(sec / 60);
	const s = Math.round(sec % 60);
	return `${m}:${String(s).padStart(2, '0')}`;
}

/** Z1–Z5 bpm ranges for a given LTHR, using the shared %LTHR boundaries. */
export function lthrZoneRows(lthr: number): LthrZoneRow[] {
	const b = HR_ZONE_THRESHOLD_PCT.map((p) => Math.round(p * lthr)); // [0, z2, z3, z4, z5]
	return HR_ZONE_NAMES.map((name, i) => {
		const low = b[i]!;
		const high = i < HR_ZONE_NAMES.length - 1 ? b[i + 1]! - 1 : null;
		const range = i === 0 ? `< ${b[1]!} bpm` : high === null ? `${low}+ bpm` : `${low}–${high} bpm`;
		return { name, range, color: HR_ZONE_COLORS[i]! };
	});
}

function extractHrSamples(stream: unknown): number[] {
	if (!stream || typeof stream !== 'object') return [];
	const records = (stream as { records?: unknown }).records;
	if (!Array.isArray(records)) return [];
	const out: number[] = [];
	for (const r of records as Array<Record<string, unknown>>) {
		const raw = r['heart_rate'] ?? r['heartRate'];
		const n = typeof raw === 'number' ? raw : Number(raw);
		if (Number.isFinite(n) && n > 0) out.push(n);
	}
	return out;
}

/**
 * Interpret one of the user's activities as an LTHR field test. Returns null
 * when the activity doesn't exist or isn't theirs.
 */
export async function interpretLthrTestForActivity(input: {
	userId: string;
	activityId: string;
}): Promise<LthrTestInterpretation | null> {
	const activity = await getActivityByIdForUser(input.activityId, input.userId);
	if (!activity) return null;

	const stream = await readStreamBlob(activity.id);
	const result = interpretLthrTest(extractHrSamples(stream));

	return {
		...result,
		activityId: activity.id,
		activityTitle: activity.title ?? 'Activity',
		segmentLabel:
			result.lthr !== null ? `${mmss(result.segmentStartSec)}–${mmss(result.segmentEndSec)}` : null,
		zones: result.lthr !== null ? lthrZoneRows(result.lthr) : []
	};
}
