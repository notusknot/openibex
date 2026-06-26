import {
	countActivitiesForUser,
	listAllActivitiesForUser,
	listRecentActivitiesForUser,
	type DbActivity
} from '$lib/server/repositories/activitiesRepository';
import {
	intensityFactorFor,
	loadFor,
	type ThresholdPrefs
} from '$lib/server/services/analytics/load';
import type { Sport } from '$lib/server/db/schema';
import { SPORT_DISPLAY } from '$lib/server/sport';
import type { UserPreferences } from '$lib/validation/userPreferences';
import { distanceFromMeters, distanceUnit, type Units } from '$lib/units';

// Slim, raw-fields-only row. Display labels (date, distance/duration/IF/HR
// strings) and the search index are derived in the browser from these numbers
// via `$lib/activities/format` + `$lib/sport`, so we don't ship redundant text
// on every row — the /activities page loads the user's entire history.
export type ActivityListRow = {
	id: string;
	sport: 'swim' | 'bike' | 'run' | 'other'; // display bucket, for the sport chips
	sportLabel: Sport; // real sport enum — drives sort + tag/color lookup client-side
	title: string;
	description: string | null; // raw; client builds the search index from title + this
	startTimeMs: number; // epoch ms, for client-side date sorting + the date label
	distanceM: number; // raw; 0 if missing
	durationSec: number; // 0 if missing
	tss: number;
	intensityFactor: number | null; // 0..1+
	avgHr: number | null;
};

export type ActivityListSummary = {
	count: number;
	tss: number;
	distance: number; // in user units (km or mi)
	distanceUnit: string; // 'km' | 'mi'
	hours: number;
};

export type ActivitiesListData = {
	rows: ActivityListRow[];
	summary: ActivityListSummary;
	totalCount: number; // total activities in DB for this user (for "Showing X of Y")
};

function shapeRow(a: DbActivity, prefs: ThresholdPrefs | null): ActivityListRow {
	return {
		id: a.id,
		sport: SPORT_DISPLAY[a.sport],
		sportLabel: a.sport,
		title: a.title,
		description: a.description ?? null,
		startTimeMs: new Date(a.startTime).getTime(),
		distanceM: a.distanceM ?? 0,
		durationSec: a.durationSec ?? 0,
		tss: Math.round(loadFor(a, prefs)),
		intensityFactor: intensityFactorFor(a, prefs),
		avgHr: a.avgHr ?? null
	};
}

/**
 * Shape a user's activities for the list UI.
 *
 * Omit `limit` to load the full set — the activities page ships every row to the
 * browser and runs search / sport-filter / pagination entirely client-side, so
 * it needs them all up front. Pass `limit` for a recent-N slice (e.g. the
 * dashboard's "recent activities"), which keeps the cheap count query so
 * "X of Y" displays stay accurate against the whole table.
 */
export async function getActivitiesList(input: {
	userId: string;
	limit?: number;
	prefs?: UserPreferences | null;
}): Promise<ActivitiesListData> {
	const prefs = input.prefs ?? null;
	const units: Units = prefs?.units ?? 'imperial';

	let activities: DbActivity[];
	let totalCount: number;
	if (input.limit === undefined) {
		activities = await listAllActivitiesForUser(input.userId);
		totalCount = activities.length;
	} else {
		[activities, totalCount] = await Promise.all([
			listRecentActivitiesForUser(input.userId, input.limit),
			countActivitiesForUser(input.userId)
		]);
	}

	const rows = activities.map((a) => shapeRow(a, prefs));

	const totalDistanceM = activities.reduce((acc, a) => acc + (a.distanceM ?? 0), 0);
	const summary: ActivityListSummary = {
		count: rows.length,
		tss: rows.reduce((acc, r) => acc + r.tss, 0),
		distance: Math.round(distanceFromMeters(totalDistanceM, units)),
		distanceUnit: distanceUnit(units),
		hours: Math.round((rows.reduce((acc, r) => acc + r.durationSec, 0) / 3600) * 10) / 10
	};

	return { rows, summary, totalCount };
}
