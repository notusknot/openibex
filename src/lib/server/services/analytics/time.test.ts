import { describe, expect, it } from 'vitest';

import { addDaysIso, weekStartIsoMonday } from '$lib/server/services/analytics/time';

describe('weekStartIsoMonday', () => {
	it('returns the same day for a Monday', () => {
		expect(weekStartIsoMonday(new Date('2026-06-15T10:00:00'))).toBe('2026-06-15'); // Mon
	});

	it('returns the previous Monday for a Sunday (end of the ISO week)', () => {
		expect(weekStartIsoMonday(new Date('2026-06-21T23:59:00'))).toBe('2026-06-15'); // Sun
	});

	it('returns the containing Monday for a mid-week day', () => {
		expect(weekStartIsoMonday(new Date('2026-06-18T00:00:00'))).toBe('2026-06-15'); // Thu
	});

	it('crosses a month boundary', () => {
		expect(weekStartIsoMonday(new Date('2026-07-01T12:00:00'))).toBe('2026-06-29'); // Wed -> Mon Jun 29
	});
});

describe('addDaysIso', () => {
	it('adds days within a month', () => {
		expect(addDaysIso('2026-06-15', 3)).toBe('2026-06-18');
	});

	it('rolls over a month boundary', () => {
		expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
	});

	it('rolls over a year boundary', () => {
		expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
	});

	it('subtracts with negative days', () => {
		expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28'); // 2026 not a leap year
	});

	it('lands on a leap day', () => {
		expect(addDaysIso('2024-02-28', 1)).toBe('2024-02-29'); // 2024 is a leap year
	});

	it('returns the same date for zero', () => {
		expect(addDaysIso('2026-06-15', 0)).toBe('2026-06-15');
	});
});
