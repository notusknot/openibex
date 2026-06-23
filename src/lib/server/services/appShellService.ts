import {
	countActivitiesForUser,
	listActivitiesForUserInTimeRange
} from '$lib/server/repositories/activitiesRepository';
import { loadFor, type ThresholdPrefs } from '$lib/server/services/analytics/load';
import type { UserPreferences } from '$lib/validation/userPreferences';
import { distanceFromMeters, type Units } from '$lib/units';

export type RailSummary = {
	activitiesCount: number;
	season: { tss: number; hours: number; distance: number; distanceUnit: 'km' | 'mi' };
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getRailSummary(
	userId: string,
	opts: { now?: Date; days?: number; prefs?: UserPreferences | null } = {}
): Promise<RailSummary> {
	const days = opts.days ?? 84;
	const to = opts.now ?? new Date();
	const from = new Date(to.getTime() - (days - 1) * DAY_MS);
	from.setHours(0, 0, 0, 0);
	const prefs = opts.prefs ?? null;
	const units: Units = prefs?.units ?? 'imperial';

	// Pull rows and sum in JS so we can apply the shared loadFor — most
	// imported activities have load_score IS NULL (parseFit doesn't compute
	// it), which a raw SQL SUM would treat as zero.
	const [activitiesCount, activities] = await Promise.all([
		countActivitiesForUser(userId),
		listActivitiesForUserInTimeRange({ userId, from, to })
	]);

	let loadSum = 0;
	let durationSecSum = 0;
	let distanceMSum = 0;
	for (const a of activities) {
		loadSum += loadFor(a, prefs as ThresholdPrefs | null);
		durationSecSum += a.durationSec ?? 0;
		distanceMSum += a.distanceM ?? 0;
	}

	return {
		activitiesCount,
		season: {
			tss: Math.round(loadSum),
			hours: Math.round(durationSecSum / 3600),
			distance: Math.round(distanceFromMeters(distanceMSum, units)),
			distanceUnit: units === 'imperial' ? 'mi' : 'km'
		}
	};
}
