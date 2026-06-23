import { Worker } from 'node:worker_threads';
import type { Sport } from '$lib/server/db/schema';

const PARSER_VERSION = 'fit-file-parser';

// ~70h at 1 Hz — beyond any real activity, ultras included. Bounds the cost of
// the synchronous JSON.stringify + gzip the callers run on the stream, and is
// also enforced inside the worker so a pathological array is never cloned back.
const MAX_STREAM_RECORDS = 250_000;

// fit-file-parser is synchronous and CPU-bound; a crafted/corrupt file can burn
// seconds. We run it in a worker thread and terminate it past this deadline so it
// can never hang the server's event loop.
const FIT_PARSE_TIMEOUT_MS = 15_000;

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

export class FitParseTimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FitParseTimeoutError';
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

/**
 * Pure mapping from the raw fit-file-parser output to our summary + stream.
 * Exported so the mapping/field-extraction logic can be unit-tested directly
 * with crafted fitData, without spawning a worker or running the real library.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapFitData(fitData: any, originalFilename: string): FitParseResult {
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
		throw new FitStreamTooLargeError(`FIT stream has ${records.length} records (max ${MAX_STREAM_RECORDS}).`);
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

// CommonJS worker body (run via `new Worker(..., { eval: true })`, so there is no
// separate file for the bundler to resolve). It requires fit-file-parser at
// runtime from node_modules, runs the synchronous parse off the main event loop,
// and rejects an over-cap stream before it can be serialized back to the host.
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
try {
  const mod = require('fit-file-parser');
  const FitParser = (mod && mod.default && mod.default.default) || (mod && mod.default) || mod;
  if (typeof FitParser !== 'function') {
    parentPort.postMessage({ error: 'parse_error', message: 'FIT parser module did not export a constructor.' });
  } else {
    const parser = new FitParser({ force: true, mode: 'both', lengthUnit: 'm', speedUnit: 'm/s', elapsedRecordField: true });
    parser.parse(workerData.bytes, (err, data) => {
      if (err) { parentPort.postMessage({ error: 'parse_error', message: String((err && err.message) || err) }); return; }
      if (data && Array.isArray(data.records) && data.records.length > workerData.maxRecords) {
        parentPort.postMessage({ error: 'too_large', count: data.records.length }); return;
      }
      parentPort.postMessage({ ok: true, data });
    });
  }
} catch (e) {
  parentPort.postMessage({ error: 'parse_error', message: String((e && e.message) || e) });
}
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runFitParseWorker(buffer: Uint8Array, timeoutMs: number): Promise<any> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const worker = new Worker(WORKER_SOURCE, {
			eval: true,
			workerData: { bytes: buffer, maxRecords: MAX_STREAM_RECORDS }
		});
		const finish = (fn: () => void) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			void worker.terminate();
			fn();
		};
		const timer = setTimeout(() => {
			finish(() => reject(new FitParseTimeoutError(`FIT parse exceeded ${timeoutMs}ms.`)));
		}, timeoutMs);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		worker.on('message', (msg: any) => {
			if (msg?.error === 'too_large') {
				finish(() =>
					reject(new FitStreamTooLargeError(`FIT stream has ${msg.count} records (max ${MAX_STREAM_RECORDS}).`))
				);
			} else if (msg?.error) {
				finish(() => reject(new Error(msg.message || 'FIT parse failed.')));
			} else {
				finish(() => resolve(msg?.data));
			}
		});
		worker.on('error', (err) => finish(() => reject(err)));
		worker.on('exit', (code) => {
			if (code !== 0) finish(() => reject(new Error(`FIT parse worker exited with code ${code}.`)));
		});
	});
}

export async function parseFit(
	buffer: Uint8Array,
	originalFilename: string,
	opts: { timeoutMs?: number } = {}
): Promise<FitParseResult> {
	const fitData = await runFitParseWorker(buffer, opts.timeoutMs ?? FIT_PARSE_TIMEOUT_MS);
	return mapFitData(fitData, originalFilename);
}
