import type { Sport } from '$lib/server/db/schema';
import { listAllActivitiesForUser } from '$lib/server/repositories/activitiesRepository';
import { deleteDailyMetricsForUser, insertDailyMetricsRows } from '$lib/server/repositories/dailyMetricsRepository';
import { fallbackLoadScore } from '$lib/server/services/analytics/load';

function clampTo0(x: number | null | undefined): number {
	return x && Number.isFinite(x) ? x : 0;
}

function localDateIso(d: Date): string {
	const yyyy = String(d.getFullYear());
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

type AggKey = string; // `${date}::${sport ?? ''}`

export async function rebuildDailyMetricsForUser(userId: string): Promise<{ rows: number }> {
	const acts = await listAllActivitiesForUser(userId);

	const map = new Map<AggKey, { date: string; sport: Sport | null; durationSec: number; distanceM: number; elevationGainM: number; loadScore: number }>();

	function add(date: string, sport: Sport | null, durationSec: number, distanceM: number, elevationGainM: number, loadScore: number) {
		const key = `${date}::${sport ?? ''}`;
		const prev = map.get(key) ?? { date, sport, durationSec: 0, distanceM: 0, elevationGainM: 0, loadScore: 0 };
		prev.durationSec += durationSec;
		prev.distanceM += distanceM;
		prev.elevationGainM += elevationGainM;
		prev.loadScore += loadScore;
		map.set(key, prev);
	}

	for (const a of acts) {
		const date = localDateIso(new Date(a.startTime));
		const durationSec = clampTo0(a.durationSec);
		const distanceM = clampTo0(a.distanceM);
		const elevationGainM = clampTo0(a.elevationGainM);
		const load = a.loadScore ?? fallbackLoadScore({ sport: a.sport as Sport, durationSec: a.durationSec ?? null }) ?? 0;
		add(date, a.sport as Sport, durationSec, distanceM, elevationGainM, load);
		add(date, null, durationSec, distanceM, elevationGainM, load);
	}

	const rows = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

	await deleteDailyMetricsForUser(userId);
	await insertDailyMetricsRows(
		userId,
		rows.map((r) => ({
			date: r.date,
			sport: r.sport,
			durationSec: r.durationSec,
			distanceM: r.distanceM,
			elevationGainM: r.elevationGainM,
			loadScore: r.loadScore
		}))
	);

	return { rows: rows.length };
}

