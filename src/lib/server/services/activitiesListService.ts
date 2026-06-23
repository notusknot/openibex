import {
	countActivitiesForUser,
	listRecentActivitiesForUser,
	type DbActivity
} from '$lib/server/repositories/activitiesRepository';
import { fallbackLoadScore } from '$lib/server/services/analytics/load';
import type { Sport } from '$lib/server/db/schema';

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
	title: string;
	distanceKm: number; // 0 if missing
	distanceLabel: string; // "13.4" or "—"
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
	km: number;
	hours: number;
};

export type ActivitiesListData = {
	rows: ActivityListRow[];
	summary: ActivityListSummary;
	totalCount: number; // total activities in DB for this user (for "Showing X of Y")
	shownLimit: number; // requested limit
};

function loadFor(a: DbActivity): number {
	const score = a.loadScore ?? fallbackLoadScore({ sport: a.sport, durationSec: a.durationSec });
	return score ?? 0;
}

// Rough intensity factor approximation:
// - Bike: avg/normalized power vs assumed FTP=240 (the same denominator used in analytics/load).
// - Run: avg HR vs assumed threshold HR=160 (rough adult endurance threshold).
// - Swim/Other: not computed (returns null).
function intensityFactor(a: DbActivity): number | null {
	if (a.sport === 'Bike') {
		const w = a.normalizedPowerLikeW ?? a.avgPowerW;
		if (w && w > 0) return w / 240;
	}
	if (a.sport === 'Run') {
		if (a.avgHr && a.avgHr > 0) return a.avgHr / 160;
	}
	return null;
}

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

function shapeRow(a: DbActivity): ActivityListRow {
	const sport = SPORT_DISPLAY[a.sport];
	const distM = a.distanceM ?? 0;
	const distKm = distM > 0 ? distM / 1000 : 0;
	const durationSec = a.durationSec ?? 0;
	const ifn = intensityFactor(a);
	const tss = Math.round(loadFor(a));
	return {
		id: a.id,
		sport,
		sportLabel: a.sport,
		tag: SPORT_TAG[sport],
		color: SPORT_COLOR_VAR[sport],
		date: formatDate(new Date(a.startTime)),
		title: a.title,
		distanceKm: distKm,
		distanceLabel: distKm > 0 ? distKm.toFixed(1) : '—',
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

export async function getActivitiesList(input: {
	userId: string;
	limit?: number;
}): Promise<ActivitiesListData> {
	const shownLimit = input.limit ?? 50;
	const [activities, totalCount] = await Promise.all([
		listRecentActivitiesForUser(input.userId, shownLimit),
		countActivitiesForUser(input.userId)
	]);
	const rows = activities.map(shapeRow);

	const summary: ActivityListSummary = {
		count: rows.length,
		tss: rows.reduce((acc, r) => acc + r.tss, 0),
		km: Math.round(rows.reduce((acc, r) => acc + r.distanceKm, 0)),
		hours: Math.round((rows.reduce((acc, r) => acc + r.durationSec, 0) / 3600) * 10) / 10
	};

	return { rows, summary, totalCount, shownLimit };
}
