import { beforeEach, describe, expect, it, vi } from 'vitest';

// Configurable mock of the underlying fit-file-parser: each test drives the
// `fitData` (or a callback error) the library "returns", so we can exercise
// parseFit's mapping/extraction logic across activity variants without real FIT
// binaries (real activity files are the user's private health data and aren't
// committed). vi.hoisted ensures `state` exists before the mock factory runs.
const state = vi.hoisted(() => ({ response: {} as { data?: unknown; err?: string } }));

vi.mock('fit-file-parser', () => {
	class FitParser {
		constructor(_opts: unknown) {}
		parse(_buffer: Uint8Array, cb: (err: Error | null, data: unknown) => void) {
			if (state.response.err) cb(new Error(state.response.err), null);
			else cb(null, state.response.data);
		}
	}
	return { default: FitParser };
});

import { parseFit, FitNotAnActivityError, FitStreamTooLargeError } from '$lib/server/parsers/fit/fitParser';

function setFitData(data: unknown) {
	state.response = { data };
}

const BYTES = new Uint8Array([1, 2, 3]);
const session = (over: Record<string, unknown> = {}) => ({
	sport: 'running',
	start_time: new Date('2026-06-15T08:00:00'),
	total_timer_time: 3600,
	total_distance: 10000,
	...over
});
const fit = (over: Record<string, unknown> = {}) => ({
	sessions: [session()],
	records: [{ t: 0 }],
	laps: [],
	...over
});
const records = (r: unknown) => (r as { records: unknown[] }).records;

beforeEach(() => {
	state.response = {};
});

describe('parseFit — activity variants (mocked library)', () => {
	it('maps the first session of a multisport file', async () => {
		setFitData(fit({ sessions: [session({ sport: 'running' }), session({ sport: 'cycling' })] }));
		expect((await parseFit(BYTES, 'a.fit')).summary.sport).toBe('Run');
	});

	it('supports the legacy single `session` property', async () => {
		setFitData({ session: session({ sport: 'cycling' }), records: [], laps: [] });
		expect((await parseFit(BYTES, 'a.fit')).summary.sport).toBe('Bike');
	});

	it('leaves missing HR and power null (indoor / no sensors)', async () => {
		setFitData(fit()); // base session has no hr/power fields
		const s = (await parseFit(BYTES, 'a.fit')).summary;
		expect(s.avgHr).toBeNull();
		expect(s.maxHr).toBeNull();
		expect(s.avgPowerW).toBeNull();
		expect(s.maxPowerW).toBeNull();
	});

	it('defaults to Other when sport is absent', async () => {
		setFitData(fit({ sessions: [{ start_time: new Date('2026-06-15T08:00:00') }] }));
		expect((await parseFit(BYTES, 'a.fit')).summary.sport).toBe('Other');
	});

	it('reads snake_case fields', async () => {
		setFitData(fit({ sessions: [session({ total_timer_time: 1800, total_distance: 5000 })] }));
		const s = (await parseFit(BYTES, 'a.fit')).summary;
		expect(s.durationSec).toBe(1800);
		expect(s.distanceM).toBe(5000);
	});

	it('falls back to camelCase fields', async () => {
		setFitData(
			fit({ sessions: [{ sport: 'running', startTime: new Date('2026-06-15T08:00:00'), totalDistance: 7500 }] })
		);
		expect((await parseFit(BYTES, 'a.fit')).summary.distanceM).toBe(7500);
	});

	it('coerces non-finite numbers to null', async () => {
		setFitData(fit({ sessions: [session({ total_distance: Infinity, avg_heart_rate: NaN })] }));
		const s = (await parseFit(BYTES, 'a.fit')).summary;
		expect(s.distanceM).toBeNull();
		expect(s.avgHr).toBeNull();
	});

	it('coerces an invalid start_time to a real Date fallback', async () => {
		setFitData(fit({ sessions: [session({ start_time: 'not-a-date' })] }));
		const s = (await parseFit(BYTES, 'a.fit')).summary;
		expect(s.startTime).toBeInstanceOf(Date);
		expect(Number.isNaN(s.startTime.getTime())).toBe(false);
	});

	it('passes null records/laps straight through', async () => {
		setFitData({ sessions: [session()], records: null, laps: null });
		const r = await parseFit(BYTES, 'a.fit');
		expect((r.stream as { records: unknown; laps: unknown }).records).toBeNull();
		expect((r.stream as { records: unknown; laps: unknown }).laps).toBeNull();
	});
});

describe('parseFit — rejections', () => {
	it('rejects a file with no session (not an activity)', async () => {
		setFitData({ records: [{ t: 0 }], laps: [] });
		await expect(parseFit(BYTES, 'settings.fit')).rejects.toBeInstanceOf(FitNotAnActivityError);
	});

	it('allows a stream at exactly the record cap', async () => {
		setFitData(fit({ records: new Array(250_000).fill({ t: 0 }) }));
		expect(records((await parseFit(BYTES, 'a.fit')).stream).length).toBe(250_000);
	});

	it('rejects a stream over the record cap', async () => {
		setFitData(fit({ records: new Array(250_001).fill({ t: 0 }) }));
		await expect(parseFit(BYTES, 'big.fit')).rejects.toBeInstanceOf(FitStreamTooLargeError);
	});

	it('rejects when the library reports an error', async () => {
		state.response = { err: 'File to small to be a FIT file' };
		await expect(parseFit(BYTES, 'broken.fit')).rejects.toThrow(/FIT file/i);
	});
});
