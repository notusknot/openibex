import { describe, expect, it } from 'vitest';

import { mapFitData, FitNotAnActivityError, FitStreamTooLargeError } from '$lib/server/parsers/fit/fitParser';

// mapFitData is the pure mapping from raw fit-file-parser output to our summary +
// stream. Testing it directly (no worker, no module mock) covers every field
// variant cleanly — the worker only runs the parse step that produces this input.
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
const recordsOf = (r: unknown) => (r as { records: unknown[] }).records;

describe('mapFitData — activity variants', () => {
	it('maps the first session of a multisport file', () => {
		const r = mapFitData(fit({ sessions: [session({ sport: 'running' }), session({ sport: 'cycling' })] }), 'a.fit');
		expect(r.summary.sport).toBe('Run');
	});

	it('supports the legacy single `session` property', () => {
		expect(mapFitData({ session: session({ sport: 'cycling' }), records: [], laps: [] }, 'a.fit').summary.sport).toBe(
			'Bike'
		);
	});

	it('leaves missing HR and power null (indoor / no sensors)', () => {
		const s = mapFitData(fit(), 'a.fit').summary;
		expect(s.avgHr).toBeNull();
		expect(s.maxHr).toBeNull();
		expect(s.avgPowerW).toBeNull();
		expect(s.maxPowerW).toBeNull();
	});

	it('defaults to Other when sport is absent', () => {
		expect(mapFitData(fit({ sessions: [{ start_time: new Date('2026-06-15T08:00:00') }] }), 'a.fit').summary.sport).toBe(
			'Other'
		);
	});

	it('reads snake_case fields', () => {
		const s = mapFitData(fit({ sessions: [session({ total_timer_time: 1800, total_distance: 5000 })] }), 'a.fit')
			.summary;
		expect(s.durationSec).toBe(1800);
		expect(s.distanceM).toBe(5000);
	});

	it('falls back to camelCase fields', () => {
		const s = mapFitData(
			fit({ sessions: [{ sport: 'running', startTime: new Date('2026-06-15T08:00:00'), totalDistance: 7500 }] }),
			'a.fit'
		).summary;
		expect(s.distanceM).toBe(7500);
	});

	it('coerces non-finite numbers to null', () => {
		const s = mapFitData(fit({ sessions: [session({ total_distance: Infinity, avg_heart_rate: NaN })] }), 'a.fit')
			.summary;
		expect(s.distanceM).toBeNull();
		expect(s.avgHr).toBeNull();
	});

	it('coerces an invalid start_time to a real Date fallback', () => {
		const s = mapFitData(fit({ sessions: [session({ start_time: 'not-a-date' })] }), 'a.fit').summary;
		expect(s.startTime).toBeInstanceOf(Date);
		expect(Number.isNaN(s.startTime.getTime())).toBe(false);
	});

	it('passes null records/laps straight through', () => {
		const r = mapFitData({ sessions: [session()], records: null, laps: null }, 'a.fit');
		expect((r.stream as { records: unknown; laps: unknown }).records).toBeNull();
		expect((r.stream as { records: unknown; laps: unknown }).laps).toBeNull();
	});
});

describe('mapFitData — rejections', () => {
	it('throws for a file with no session (not an activity)', () => {
		expect(() => mapFitData({ records: [{ t: 0 }], laps: [] }, 'settings.fit')).toThrow(FitNotAnActivityError);
	});

	it('allows a stream at exactly the record cap', () => {
		const r = mapFitData(fit({ records: new Array(250_000).fill({ t: 0 }) }), 'a.fit');
		expect(recordsOf(r.stream).length).toBe(250_000);
	});

	it('throws for a stream over the record cap', () => {
		expect(() => mapFitData(fit({ records: new Array(250_001).fill({ t: 0 }) }), 'big.fit')).toThrow(
			FitStreamTooLargeError
		);
	});
});
