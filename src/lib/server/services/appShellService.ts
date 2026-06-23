import {
	countActivitiesForUser,
	sumActivitiesForUserInTimeRange
} from '$lib/server/repositories/activitiesRepository';

export type RailSummary = {
	activitiesCount: number;
	season: { tss: number; hours: number; km: number };
};

export async function getRailSummary(
	userId: string,
	opts: { now?: Date; days?: number } = {}
): Promise<RailSummary> {
	const days = opts.days ?? 84;
	const to = opts.now ?? new Date();
	const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
	from.setHours(0, 0, 0, 0);

	const [activitiesCount, sums] = await Promise.all([
		countActivitiesForUser(userId),
		sumActivitiesForUserInTimeRange({ userId, from, to })
	]);

	return {
		activitiesCount,
		season: {
			tss: Math.round(sums.loadSum),
			hours: Math.round(sums.durationSecSum / 3600),
			km: Math.round(sums.distanceMSum / 1000)
		}
	};
}
