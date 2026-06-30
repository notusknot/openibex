import { describe, expect, it } from 'vitest';
import { dayBoundsFromKey, localDayKey, startOfLocalDay } from '$lib/server/time';

describe('time helpers (explicit tz, independent of process zone)', () => {
	it('buckets a UTC instant by the athlete local day, not the UTC day', () => {
		// 2026-06-30 18:00 in America/Los_Angeles (UTC-7) === 2026-07-01T01:00Z.
		// A UTC server would call this July 1; with the athlete zone it stays June 30.
		const instant = new Date('2026-07-01T01:00:00Z');
		expect(localDayKey(instant, 'America/Los_Angeles')).toBe('2026-06-30');
		expect(localDayKey(instant, 'UTC')).toBe('2026-07-01');
	});

	it('startOfLocalDay returns the instant of local midnight in the zone', () => {
		const instant = new Date('2026-07-01T01:00:00Z');
		// Local midnight of 2026-06-30 in LA (UTC-7) is 2026-06-30T07:00Z.
		expect(startOfLocalDay(instant, 'America/Los_Angeles').toISOString()).toBe('2026-06-30T07:00:00.000Z');
	});

	it('dayBoundsFromKey spans the whole local day', () => {
		const { from, to } = dayBoundsFromKey('2026-06-30', 'America/Los_Angeles');
		expect(from.toISOString()).toBe('2026-06-30T07:00:00.000Z');
		// 24h - 1ms later.
		expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
		// An 18:00-local activity falls inside the bounds.
		const activity = new Date('2026-07-01T01:00:00Z');
		expect(activity.getTime()).toBeGreaterThanOrEqual(from.getTime());
		expect(activity.getTime()).toBeLessThanOrEqual(to.getTime());
	});
});
