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

// The rail summary is loaded by the shared app layout on EVERY navigation, where
// it re-ran an 84-day range scan + a full count + a JS reduce each time (and on
// the dashboard, duplicated the dashboard's identical query). A short in-memory
// TTL cache collapses rapid navigations into one query. The key includes the
// prefs that change the numbers (units + thresholds via loadFor), so a settings
// change is reflected immediately; only newly-imported activities are delayed,
// for at most the TTL — fine for a season-summary sidebar.
const RAIL_CACHE_TTL_MS = 20_000;
type RailCacheEntry = { at: number; value: RailSummary };
const railCache = new Map<string, RailCacheEntry>();

function railCacheKey(userId: string, prefs: UserPreferences | null): string {
	return `${userId}|${prefs?.units ?? ''}|${prefs?.ftpWatts ?? ''}|${prefs?.thresholdHrBpm ?? ''}`;
}

export async function getRailSummary(
	userId: string,
	opts: { now?: Date; days?: number; prefs?: UserPreferences | null } = {}
): Promise<RailSummary> {
	const days = opts.days ?? 84;
	const prefs = opts.prefs ?? null;
	const units: Units = prefs?.units ?? 'imperial';

	// Cache only the production path (no injected clock / custom window), so tests
	// stay deterministic.
	const cacheable = opts.now === undefined && opts.days === undefined;
	const key = railCacheKey(userId, prefs);
	if (cacheable) {
		const hit = railCache.get(key);
		if (hit && Date.now() - hit.at < RAIL_CACHE_TTL_MS) return hit.value;
	}

	const to = opts.now ?? new Date();
	const from = new Date(to.getTime() - (days - 1) * DAY_MS);
	from.setHours(0, 0, 0, 0);

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

	const value: RailSummary = {
		activitiesCount,
		season: {
			tss: Math.round(loadSum),
			hours: Math.round(durationSecSum / 3600),
			distance: Math.round(distanceFromMeters(distanceMSum, units)),
			distanceUnit: units === 'imperial' ? 'mi' : 'km'
		}
	};
	if (cacheable) railCache.set(key, { at: Date.now(), value });
	return value;
}
