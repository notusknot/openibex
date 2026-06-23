import {
	countActivitiesForUser,
	listActivitiesForUserInTimeRange
} from '$lib/server/repositories/activitiesRepository';
import { fallbackLoadScore } from '$lib/server/services/analytics/load';

export type RailSummary = {
	activitiesCount: number;
	season: { tss: number; hours: number; km: number };
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getRailSummary(
	userId: string,
	opts: { now?: Date; days?: number } = {}
): Promise<RailSummary> {
	const days = opts.days ?? 84;
	const to = opts.now ?? new Date();
	const from = new Date(to.getTime() - (days - 1) * DAY_MS);
	from.setHours(0, 0, 0, 0);

	// Pull rows and sum in JS so we can apply fallbackLoadScore — most imported
	// activities have load_score IS NULL (parseFit doesn't compute it), which
	// a raw SQL SUM treats as zero. Matches the dashboard's loadFor() logic.
	const [activitiesCount, activities] = await Promise.all([
		countActivitiesForUser(userId),
		listActivitiesForUserInTimeRange({ userId, from, to })
	]);

	let loadSum = 0;
	let durationSecSum = 0;
	let distanceMSum = 0;
	for (const a of activities) {
		const score = a.loadScore ?? fallbackLoadScore({ sport: a.sport, durationSec: a.durationSec });
		loadSum += score ?? 0;
		durationSecSum += a.durationSec ?? 0;
		distanceMSum += a.distanceM ?? 0;
	}

	return {
		activitiesCount,
		season: {
			tss: Math.round(loadSum),
			hours: Math.round(durationSecSum / 3600),
			km: Math.round(distanceMSum / 1000)
		}
	};
}
