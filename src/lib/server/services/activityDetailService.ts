import {
	getActivityByIdForUser,
	deleteActivityForUser,
	type DbActivity
} from '$lib/server/repositories/activitiesRepository';
import {
	getActivityFileByIdForUser,
	deleteActivityFileForUser,
	type DbActivityFile
} from '$lib/server/repositories/activityFilesRepository';
import { getPlannedWorkoutByIdForUser } from '$lib/server/repositories/plannedWorkoutsRepository';
import { getWorkoutLinkForActivity } from '$lib/server/repositories/workoutLinksRepository';
import {
	readStreamBlob,
	removeFile,
	removeStreamBlob
} from '$lib/server/services/fileStorageService';
import {
	intensityFactorFor,
	loadFor as sharedLoadFor,
	type ThresholdPrefs
} from '$lib/server/services/analytics/load';
import type { Sport } from '$lib/server/db/schema';
import { SPORT_COLOR_VAR, SPORT_TAG } from '$lib/server/sport';
import type { ActivityTrack, TrackPoint } from '$lib/track';
import { HR_ZONE_COLORS, HR_ZONE_NAMES, hrZoneIndex } from '$lib/zones';
import type { UserPreferences } from '$lib/validation/userPreferences';
import {
	distanceLabel,
	distanceUnit,
	elevationLabel,
	elevationUnit,
	paceLabel,
	paceUnit,
	type Units
} from '$lib/units';

// The shared point + track types live in `$lib/track` (isomorphic) so client
// components can import them too; re-exported here for existing call sites.
export type { TrackPoint, ActivityTrack, ActivityTrackMetrics } from '$lib/track';

export type ActivityLapRow = {
	label: string;
	distance: string;
	time: string;
	pace: string;
	avgHr: number | null;
	hrWidth: string;
	kind: 'on' | 'off' | 'warm';
};

export type ActivityHrZone = { name: string; pct: number; w: string; color: string };
export type ActivityPeak = { label: string; val: string };

export type ActivitySummaryStat = { label: string; val: string; unit: string };

export type ActivityShaped = {
	id: string;
	sport: Sport;
	sportTag: string;
	sportColor: string;
	title: string;
	dateLabel: string;
	startTime: Date;
	durationSec: number | null;
	distanceM: number | null;
};

export type ActivityDetailData = {
	activity: ActivityShaped;
	file: { id: string; originalFilename: string; sha256: string; sizeBytes: number } | null;
	link: {
		matchType: string;
		durationCompliance: number | null;
		distanceCompliance: number | null;
		loadCompliance: number | null;
	} | null;
	planned: { id: string; title: string; scheduledDate: string } | null;
	summaryStats: ActivitySummaryStat[];
	track: ActivityTrack;
	laps: ActivityLapRow[];
	hrZones: ActivityHrZone[];
	peaks: ActivityPeak[];
};

function asFiniteNumber(v: unknown): number | null {
	if (v === null || v === undefined) return null;
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}

function asDate(v: unknown): Date | null {
	if (!v) return null;
	const d = v instanceof Date ? v : new Date(String(v));
	return Number.isNaN(d.getTime()) ? null : d;
}

function fmtHM(durationSec: number | null): string {
	if (!durationSec || durationSec <= 0) return '—';
	const s = Math.round(durationSec);
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
	return `${m}:${sec.toString().padStart(2, '0')}`;
}

function fmtMs(durationSec: number | null): string {
	if (!durationSec || durationSec <= 0) return '—';
	const s = Math.round(durationSec);
	const m = Math.floor(s / 60);
	const sec = s % 60;
	return `${m}:${sec.toString().padStart(2, '0')}`;
}

function fmtPaceWithUnit(secPerKm: number | null, units: Units): string {
	const label = paceLabel(secPerKm, units);
	if (label === '—') return '—';
	return `${label}${paceUnit(units)}`;
}

function fmtDateLong(d: Date): string {
	return d.toLocaleString(undefined, {
		weekday: 'long',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}


// Evenly pick up to `target` items across the full range (first and last always
// kept), preserving order. This bounds the shared point array — the map and the
// charts both render from it — by time/order rather than by GPS geometry:
// geometry-based simplification (Douglas–Peucker) would drop points on straight
// sections even where elevation/pace are changing, flattening the charts.
function sampleEven<T>(arr: T[], target: number): T[] {
	const n = arr.length;
	if (n <= target || target < 2) return arr.slice();
	const out: T[] = new Array(target);
	for (let i = 0; i < target; i++) {
		out[i] = arr[Math.round((i / (target - 1)) * (n - 1))]!;
	}
	return out;
}

function classifyLapKind(lap: Record<string, unknown>): 'on' | 'off' | 'warm' {
	const intensity = String(lap['intensity'] ?? '').toLowerCase();
	if (intensity.includes('warmup') || intensity.includes('cooldown') || intensity.includes('warm')) return 'warm';
	if (intensity === 'rest' || intensity === 'recovery' || intensity.includes('rest')) return 'off';
	if (intensity === 'active' || intensity === 'interval' || intensity.includes('active')) return 'on';
	return 'on';
}

function lapShortLabel(lap: Record<string, unknown>, index: number, totalActiveSeen: number, kind: 'on' | 'off' | 'warm'): string {
	const intensity = String(lap['intensity'] ?? '').toLowerCase();
	if (intensity.includes('warmup')) return 'WU';
	if (intensity.includes('cooldown')) return 'CD';
	if (kind === 'off') return '–';
	// Numbered active laps:
	return String(totalActiveSeen);
}

export function computeHrZones(hrSamples: number[], maxHrHint: number | null): ActivityHrZone[] {
	if (hrSamples.length === 0) return [];
	const maxRef = maxHrHint && maxHrHint > 100 ? maxHrHint : Math.max(...hrSamples);
	if (!Number.isFinite(maxRef) || maxRef <= 0) return [];
	const counts = [0, 0, 0, 0, 0];
	for (const hr of hrSamples) {
		if (!Number.isFinite(hr) || hr <= 0) continue;
		counts[hrZoneIndex(hr, maxRef)]! += 1;
	}
	const total = counts.reduce((a, b) => a + b, 0);
	if (total === 0) return [];
	return counts.map((c, i) => {
		const pct = Math.round((c / total) * 100);
		return { name: HR_ZONE_NAMES[i]!, pct, w: `${pct}%`, color: HR_ZONE_COLORS[i]! };
	});
}

// Best continuous-distance time over the records' (cumulative distance, time) sequence.
// Two-pointer sliding window; O(n) per target distance.
export function bestSegmentTime(
	cumulativeDistanceM: number[],
	cumulativeTimeSec: number[],
	targetMeters: number
): number | null {
	if (cumulativeDistanceM.length < 2) return null;
	const lastDist = cumulativeDistanceM[cumulativeDistanceM.length - 1]!;
	if (lastDist < targetMeters) return null;
	let best = Infinity;
	let lo = 0;
	for (let hi = 0; hi < cumulativeDistanceM.length; hi++) {
		while (lo < hi && cumulativeDistanceM[hi]! - cumulativeDistanceM[lo + 1]! >= targetMeters) lo += 1;
		if (cumulativeDistanceM[hi]! - cumulativeDistanceM[lo]! >= targetMeters) {
			const t = cumulativeTimeSec[hi]! - cumulativeTimeSec[lo]!;
			if (t > 0 && t < best) best = t;
		}
	}
	return Number.isFinite(best) ? best : null;
}

export async function getActivityDetail(input: {
	userId: string;
	activityId: string;
	prefs?: UserPreferences | null;
}): Promise<ActivityDetailData | null> {
	const activity = await getActivityByIdForUser(input.activityId, input.userId);
	if (!activity) return null;
	const prefs = input.prefs ?? null;
	const units: Units = prefs?.units ?? 'imperial';

	const [fileRow, link, streamRaw] = await Promise.all([
		activity.activityFileId
			? getActivityFileByIdForUser(activity.activityFileId, input.userId)
			: Promise.resolve<DbActivityFile | undefined>(undefined),
		getWorkoutLinkForActivity(input.userId, activity.id),
		readStreamBlob(activity.id)
	]);

	const planned = link
		? await getPlannedWorkoutByIdForUser(link.plannedWorkoutId, input.userId)
		: null;

	const shaped: ActivityShaped = {
		id: activity.id,
		sport: activity.sport,
		sportTag: SPORT_TAG[activity.sport],
		sportColor: SPORT_COLOR_VAR[activity.sport],
		title: activity.title,
		dateLabel: fmtDateLong(new Date(activity.startTime)),
		startTime: new Date(activity.startTime),
		durationSec: activity.durationSec ?? null,
		distanceM: activity.distanceM ?? null
	};

	// Stream extraction
	const stream = (streamRaw ?? {}) as Record<string, unknown>;
	const records = Array.isArray(stream['records']) ? (stream['records'] as Array<Record<string, unknown>>) : [];
	const lapsRaw = Array.isArray(stream['laps']) ? (stream['laps'] as Array<Record<string, unknown>>) : [];

	const rawHr: number[] = [];
	const rawSpeed: number[] = [];
	const cumDist: number[] = [];
	const cumTime: number[] = [];
	const rawPoints: TrackPoint[] = [];
	const startMs = new Date(activity.startTime).getTime();

	// Pace from speed: pace[sec/km] = 1000 / speed[m/s]. Cap at 20:00/km so stops
	// don't blow out the axis (matches the previous chart behavior).
	const PACE_CAP = 1200;

	let gpsCount = 0;
	let powerSeen = false;
	let elevSeen = false;

	for (const r of records) {
		const hr = asFiniteNumber(r['heart_rate'] ?? r['heartRate']);
		if (hr !== null) rawHr.push(hr);
		const speed = asFiniteNumber(r['speed'] ?? r['enhanced_speed']);
		if (speed !== null) rawSpeed.push(speed);
		const dist = asFiniteNumber(r['distance']);
		const ts = asDate(r['timestamp']);
		if (dist !== null && ts) {
			cumDist.push(dist);
			cumTime.push(Math.max(0, (ts.getTime() - startMs) / 1000));
		}

		// Build one shared point per record (fed to both the map and the charts).
		// fit-file-parser yields position_lat/long already in decimal degrees.
		const lat = asFiniteNumber(r['position_lat']);
		const lng = asFiniteNumber(r['position_long']);
		const hasGps =
			lat !== null &&
			lng !== null &&
			Math.abs(lat) <= 90 &&
			Math.abs(lng) <= 180 &&
			!(lat === 0 && lng === 0); // drop the FIT "null island" sentinel
		if (hasGps) gpsCount += 1;
		const power = asFiniteNumber(r['power']);
		if (power !== null && power > 0) powerSeen = true;
		const elevation = asFiniteNumber(r['enhanced_altitude'] ?? r['altitude']);
		if (elevation !== null) elevSeen = true;
		const pace = speed !== null ? (speed > 0.2 ? Math.min(PACE_CAP, 1000 / speed) : PACE_CAP) : null;
		rawPoints.push({
			t: ts ? Math.max(0, (ts.getTime() - startMs) / 1000) : rawPoints.length,
			lat: hasGps ? lat : null,
			lng: hasGps ? lng : null,
			hr,
			pace,
			power,
			elevation,
			distance: dist
		});
	}

	const hrAvail = rawHr.length > 0;
	const hasPace = rawSpeed.length > 0 && rawSpeed.some((s) => s > 0.5);

	// Max-HR reference (same basis as the zone histogram), so the map can bucket
	// points into HR zones client-side.
	const maxHrCandidate =
		activity.maxHr && activity.maxHr > 100 ? activity.maxHr : rawHr.length ? Math.max(...rawHr) : 0;
	const maxHrRef = Number.isFinite(maxHrCandidate) && maxHrCandidate > 0 ? maxHrCandidate : null;

	// Shared point array driving BOTH the route map and the time-series charts.
	// Capped by even time/order sampling (not GPS geometry — see sampleEven): most
	// activities fall under the cap and keep every Garmin sample; only very long
	// ones thin out, still smooth. The ~268px canvas map is unaffected by the extra
	// density (canvas draws any segment count for free).
	const POINT_CAP = 1800;
	let points: TrackPoint[];
	let bounds: ActivityTrack['bounds'] = null;
	if (gpsCount >= 2) {
		const gpsPoints = rawPoints.filter((p) => p.lat !== null && p.lng !== null);
		points = sampleEven(gpsPoints, POINT_CAP);
		let minLat = Infinity;
		let maxLat = -Infinity;
		let minLng = Infinity;
		let maxLng = -Infinity;
		for (const p of points) {
			minLat = Math.min(minLat, p.lat!);
			maxLat = Math.max(maxLat, p.lat!);
			minLng = Math.min(minLng, p.lng!);
			maxLng = Math.max(maxLng, p.lng!);
		}
		bounds = { minLat, maxLat, minLng, maxLng };
	} else {
		points = sampleEven(rawPoints, POINT_CAP);
	}

	// Laps shape
	const maxLapHr = lapsRaw.reduce((acc, l) => {
		const h = asFiniteNumber(l['avg_heart_rate'] ?? l['avgHr']);
		return h && h > acc ? h : acc;
	}, 0);
	let activeSeen = 0;
	const laps: ActivityLapRow[] = lapsRaw.map((lap, i) => {
		const kind = classifyLapKind(lap);
		if (kind === 'on' || kind === 'warm') activeSeen += kind === 'on' ? 1 : 0;
		const label = lapShortLabel(lap, i, activeSeen, kind);
		const distM = asFiniteNumber(lap['total_distance'] ?? lap['totalDistance']) ?? 0;
		const timeSec =
			asFiniteNumber(lap['total_timer_time'] ?? lap['totalTimerTime'] ?? lap['total_elapsed_time']) ?? 0;
		const avgHr = asFiniteNumber(lap['avg_heart_rate'] ?? lap['avgHr']);
		const paceSecPerKm = distM > 0 && timeSec > 0 ? (timeSec / distM) * 1000 : null;
		const hrWidthN = avgHr && maxLapHr > 0 ? Math.round((avgHr / maxLapHr) * 100) : 0;
		return {
			label,
			distance:
				distM > 0
					? `${distanceLabel(distM, units, 2)} ${distanceUnit(units)}`
					: '—',
			time: fmtMs(timeSec),
			pace: fmtPaceWithUnit(paceSecPerKm, units),
			avgHr: avgHr ? Math.round(avgHr) : null,
			hrWidth: `${hrWidthN}%`,
			kind
		};
	});

	// HR zones
	const hrZones = computeHrZones(rawHr, activity.maxHr ?? null);

	// Peak efforts
	const peaks: ActivityPeak[] = [];
	const peakTargets: { label: string; meters: number }[] = [
		{ label: 'Best 400m', meters: 400 },
		{ label: 'Best 800m', meters: 800 },
		{ label: 'Best 1 km', meters: 1000 }
	];
	for (const t of peakTargets) {
		const best = bestSegmentTime(cumDist, cumTime, t.meters);
		if (best !== null) peaks.push({ label: t.label, val: fmtMs(best) });
	}
	if (activity.maxHr) {
		peaks.push({ label: 'Max HR', val: `${Math.round(activity.maxHr)} bpm` });
	} else if (rawHr.length > 0) {
		peaks.push({ label: 'Max HR', val: `${Math.round(Math.max(...rawHr))} bpm` });
	}

	// Summary stat bar (8 cells)
	const distanceM = activity.distanceM ?? 0;
	const distanceKm = distanceM / 1000;
	const avgPaceSecPerKm =
		distanceKm > 0 && activity.durationSec && activity.durationSec > 0
			? activity.durationSec / distanceKm
			: null;
	const tss = Math.round(sharedLoadFor(activity, prefs as ThresholdPrefs | null));
	const intensityFactor = intensityFactorFor(activity, prefs as ThresholdPrefs | null);

	const summaryStats: ActivitySummaryStat[] = [
		{ label: 'Duration', val: fmtHM(activity.durationSec), unit: '' },
		{
			label: 'Distance',
			val: distanceM > 0 ? distanceLabel(distanceM, units, 2) : '—',
			unit: distanceM > 0 ? distanceUnit(units) : ''
		},
		{ label: 'TSS', val: tss > 0 ? String(tss) : '—', unit: '' },
		{ label: 'IF', val: intensityFactor !== null ? intensityFactor.toFixed(2) : '—', unit: '' },
		{
			label: 'Avg pace',
			val:
				avgPaceSecPerKm !== null && activity.sport !== 'Bike'
					? paceLabel(avgPaceSecPerKm, units)
					: '—',
			unit:
				avgPaceSecPerKm !== null && activity.sport !== 'Bike' ? paceUnit(units) : ''
		},
		{
			label: 'Avg HR',
			val: activity.avgHr ? String(Math.round(activity.avgHr)) : '—',
			unit: activity.avgHr ? 'bpm' : ''
		},
		{
			label: 'Elevation',
			val:
				activity.elevationGainM !== null && activity.elevationGainM !== undefined
					? elevationLabel(activity.elevationGainM, units)
					: '—',
			unit:
				activity.elevationGainM !== null && activity.elevationGainM !== undefined
					? elevationUnit(units)
					: ''
		},
		{
			label: 'Calories',
			val: activity.calories ? String(Math.round(activity.calories)) : '—',
			unit: ''
		}
	];

	const track: ActivityTrack = {
		hasGps: bounds !== null,
		points,
		bounds,
		metrics: { hr: hrAvail, pace: hasPace, power: powerSeen, elevation: elevSeen },
		maxHrRef,
		units,
		durationSec: activity.durationSec ?? 0,
		distanceLabel:
			distanceM > 0 ? `${distanceLabel(distanceM, units, 1)} ${distanceUnit(units)}` : '—',
		elevationLabel:
			activity.elevationGainM !== null && activity.elevationGainM !== undefined
				? `${elevationLabel(activity.elevationGainM, units)} ${elevationUnit(units)} ↑`
				: ''
	};

	const file = fileRow
		? {
				id: fileRow.id,
				originalFilename: fileRow.originalFilename,
				sha256: fileRow.sha256,
				sizeBytes: fileRow.sizeBytes
			}
		: null;

	const linkOut = link
		? {
				matchType: link.matchType,
				durationCompliance: link.durationCompliance ?? null,
				distanceCompliance: link.distanceCompliance ?? null,
				loadCompliance: link.loadCompliance ?? null
			}
		: null;

	const plannedOut = planned
		? { id: planned.id, title: planned.title, scheduledDate: planned.scheduledDate }
		: null;

	return {
		activity: shaped,
		file,
		link: linkOut,
		planned: plannedOut,
		summaryStats,
		track,
		laps,
		hrZones,
		peaks
	};
}

/**
 * Permanently delete an activity belonging to a user, along with its parsed
 * stream blob and its original uploaded file. Workout links are removed by the
 * `ON DELETE CASCADE` on the activities row; import_items/import_jobs back-refs
 * fall away via the schema's set-null / cascade rules. Returns false if the
 * activity doesn't exist (or isn't owned by the user).
 */
export async function deleteActivity(input: {
	userId: string;
	activityId: string;
}): Promise<boolean> {
	const activity = await getActivityByIdForUser(input.activityId, input.userId);
	if (!activity) return false;

	// Drop the original upload (file row + bytes on disk) so a re-upload of the
	// same FIT isn't rejected as a duplicate of a now-deleted activity.
	if (activity.activityFileId) {
		const file = await getActivityFileByIdForUser(activity.activityFileId, input.userId);
		if (file) {
			await removeFile(file.filePath);
			await deleteActivityFileForUser({ id: file.id, userId: input.userId });
		}
	}

	await removeStreamBlob(input.activityId);
	await deleteActivityForUser({ id: input.activityId, userId: input.userId });
	return true;
}
