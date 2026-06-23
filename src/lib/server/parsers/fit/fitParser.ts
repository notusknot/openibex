import type { Sport } from '$lib/server/db/schema';

const PARSER_VERSION = 'fit-file-parser';

// ~70h at 1 Hz — beyond any real activity, ultras included. Bounds the cost of
// the synchronous JSON.stringify + gzip the callers run on the stream, so a
// crafted/corrupt FIT with a pathological records array can't hang the event
// loop. fit-file-parser is synchronous, so a Promise timeout can't interrupt the
// parse itself — bounding the output (and the already-capped input) is the
// effective guard.
const MAX_STREAM_RECORDS = 250_000;

export class FitNotAnActivityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FitNotAnActivityError';
	}
}

export class FitStreamTooLargeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FitStreamTooLargeError';
	}
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Sensible default title for parseFit's return shape. Almost always overridden
// by the caller (garmin / single-upload services compose a smart title from
// Garmin metadata + time-of-day). Kept here so parseFit produces a self-
// contained result even when called outside the normal pipelines.
function composeFallbackTitle(input: {
	originalFilename: string;
	sport: Sport;
	startTime: Date;
}): string {
	const base = input.originalFilename.replace(/\.[^/.]+$/, '').trim();
	const nonMeaningful =
		base.length === 0 ||
		base.includes('@') ||
		/^[0-9]+$/.test(base) ||
		/^[0-9]+_ACTIVITY$/i.test(base);
	if (!nonMeaningful) return base;
	const d = input.startTime;
	return `${input.sport} · ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function mapSport(raw: unknown): Sport {
	const s = String(raw ?? '').toLowerCase();
	if (s.includes('run')) return 'Run';
	if (s.includes('bike') || s.includes('cycling')) return 'Bike';
	if (s.includes('swim')) return 'Swim';
	if (s.includes('strength')) return 'Strength';
	return 'Other';
}

function coerceNumber(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function coerceDate(value: unknown): Date | null {
	if (!value) return null;
	const d = value instanceof Date ? value : new Date(String(value));
	return Number.isNaN(d.getTime()) ? null : d;
}

export type FitParseResult = {
	summary: {
		sport: Sport;
		title: string;
		startTime: Date;
		durationSec: number | null;
		movingTimeSec: number | null;
		distanceM: number | null;
		elevationGainM: number | null;
		avgHr: number | null;
		maxHr: number | null;
		avgPowerW: number | null;
		maxPowerW: number | null;
		avgCadence: number | null;
		calories: number | null;
	};
	stream: unknown;
	parserVersion: string;
};

export async function parseFit(buffer: Uint8Array, originalFilename: string): Promise<FitParseResult> {
	const mod: any = await import('fit-file-parser');
	// fit-file-parser is published as CJS; in ESM contexts this often becomes `mod.default.default`.
	const FitParser = mod?.default?.default ?? mod?.default ?? mod;
	if (typeof FitParser !== 'function') {
		throw new Error('FIT parser module did not export a constructor.');
	}
	const parser = new FitParser({
		force: true,
		mode: 'both',
		lengthUnit: 'm',
		speedUnit: 'm/s',
		elapsedRecordField: true
	});

	const fitData: any = await new Promise((resolve, reject) => {
		parser.parse(buffer, (err: Error | null, data: any) => {
			if (err) reject(err);
			else resolve(data);
		});
	});

	const session = Array.isArray(fitData?.sessions) ? fitData.sessions[0] : fitData?.session;
	if (!session) {
		throw new FitNotAnActivityError(
			'FIT file has no session message (likely a device-sync, settings, course, workout, or monitoring file, not an activity recording).'
		);
	}
	const sport = mapSport(session?.sport ?? session?.sportProfile ?? session?.subSport ?? fitData?.sport);

	const startTime = coerceDate(session?.start_time ?? session?.startTime ?? fitData?.start_time) ?? new Date();
	const durationSec =
		coerceNumber(session?.total_timer_time ?? session?.totalTimerTime ?? session?.total_elapsed_time) ?? null;
	const movingTimeSec = coerceNumber(session?.total_moving_time ?? session?.totalMovingTime) ?? null;
	const distanceM = coerceNumber(session?.total_distance ?? session?.totalDistance) ?? null;
	const elevationGainM = coerceNumber(session?.total_ascent ?? session?.totalAscent) ?? null;
	const avgHr = coerceNumber(session?.avg_heart_rate ?? session?.avgHeartRate) ?? null;
	const maxHr = coerceNumber(session?.max_heart_rate ?? session?.maxHeartRate) ?? null;
	const avgPowerW = coerceNumber(session?.avg_power ?? session?.avgPower) ?? null;
	const maxPowerW = coerceNumber(session?.max_power ?? session?.maxPower) ?? null;
	const avgCadence = coerceNumber(session?.avg_cadence ?? session?.avgCadence) ?? null;
	const calories = coerceNumber(session?.total_calories ?? session?.totalCalories) ?? null;

	const title = composeFallbackTitle({ originalFilename, sport, startTime });

	const records = fitData?.records ?? null;
	const laps = fitData?.laps ?? null;
	if (Array.isArray(records) && records.length > MAX_STREAM_RECORDS) {
		throw new FitStreamTooLargeError(
			`FIT stream has ${records.length} records (max ${MAX_STREAM_RECORDS}).`
		);
	}
	const stream = { records, laps };

	return {
		summary: {
			sport,
			title,
			startTime,
			durationSec,
			movingTimeSec,
			distanceM,
			elevationGainM,
			avgHr,
			maxHr,
			avgPowerW,
			maxPowerW,
			avgCadence,
			calories
		},
		stream,
		parserVersion: PARSER_VERSION
	};
}
