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
import type { UserPreferences } from '$lib/validation/userPreferences';
import { distanceFromMeters, distanceUnit, type Units } from '$lib/units';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SPORT_DISPLAY: Record<Sport, 'swim' | 'bike' | 'run' | 'other'> = {
	Swim: 'swim',
	Bike: 'bike',
	Run: 'run',
	Strength: 'other',
	Other: 'other'
};

const SPORT_COLOR_VAR: Record<'swim' | 'bike' | 'run' | 'other', string> = {
	swim: 'var(--swim)',
	bike: 'var(--bike)',
	run: 'var(--run)',
	other: 'var(--muted)'
};

const SPORT_TAG: Record<'swim' | 'bike' | 'run' | 'other', string> = {
	swim: 'SWIM',
	bike: 'BIKE',
	run: 'RUN',
	other: 'OTHER'
};

export type ActivityListRow = {
	id: string;
	sport: 'swim' | 'bike' | 'run' | 'other';
	sportLabel: Sport;
	tag: string;
	color: string;
	date: string; // "Mon 6/21"
	startTimeMs: number; // epoch ms, for client-side date sorting
	title: string;
	searchText: string; // lowercased title + description, for client-side search
	distanceM: number; // raw; 0 if missing
	distanceDisplay: number; // already converted to user units
	distanceLabel: string; // "13.4" or "—"
	distanceUnitLabel: string; // "km" or "mi"
	durationSec: number; // 0 if missing
	durationLabel: string; // "1:04" or "—"
	tss: number;
	intensityFactor: number | null; // 0..1+
	ifLabel: string; // "0.84" or "—"
	ifPctWidth: string; // CSS percent string
	avgHr: number | null;
	hrLabel: string; // "152" or "—"
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

function formatDate(d: Date): string {
	return `${DOW[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDuration(durationSec: number | null): string {
	if (!durationSec || durationSec <= 0) return '—';
	const total = Math.round(durationSec / 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return `${h}:${m.toString().padStart(2, '0')}`;
}

function shapeRow(a: DbActivity, prefs: ThresholdPrefs | null, units: Units): ActivityListRow {
	const sport = SPORT_DISPLAY[a.sport];
	const distM = a.distanceM ?? 0;
	const distDisplay = distM > 0 ? distanceFromMeters(distM, units) : 0;
	const durationSec = a.durationSec ?? 0;
	const ifn = intensityFactorFor(a, prefs);
	const tss = Math.round(loadFor(a, prefs));
	return {
		id: a.id,
		sport,
		sportLabel: a.sport,
		tag: SPORT_TAG[sport],
		color: SPORT_COLOR_VAR[sport],
		date: formatDate(new Date(a.startTime)),
		startTimeMs: new Date(a.startTime).getTime(),
		title: a.title,
		searchText: `${a.title} ${a.description ?? ''}`.toLowerCase(),
		distanceM: distM,
		distanceDisplay: distDisplay,
		distanceLabel: distM > 0 ? distDisplay.toFixed(1) : '—',
		distanceUnitLabel: distanceUnit(units),
		durationSec,
		durationLabel: formatDuration(a.durationSec),
		tss,
		intensityFactor: ifn,
		ifLabel: ifn !== null ? ifn.toFixed(2) : '—',
		ifPctWidth: `${Math.max(0, Math.min(120, Math.round((ifn ?? 0) * 100)))}%`,
		avgHr: a.avgHr,
		hrLabel: a.avgHr ? String(Math.round(a.avgHr)) : '—'
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

	const rows = activities.map((a) => shapeRow(a, prefs, units));

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
