import { describe, expect, it } from 'vitest';
import { isLocalDate } from '$lib/validation/localDate';

describe('isLocalDate', () => {
	it('accepts real calendar dates', () => {
		expect(isLocalDate('2026-06-30')).toBe(true);
		expect(isLocalDate('2024-02-29')).toBe(true); // leap day
	});

	it('rejects impossible calendar dates (no silent rollover)', () => {
		expect(isLocalDate('2026-02-31')).toBe(false);
		expect(isLocalDate('2026-02-29')).toBe(false); // 2026 is not a leap year
		expect(isLocalDate('2026-04-31')).toBe(false);
		expect(isLocalDate('2026-13-01')).toBe(false);
		expect(isLocalDate('2026-00-10')).toBe(false);
	});

	it('rejects malformed strings', () => {
		expect(isLocalDate('2026-6-9')).toBe(false);
		expect(isLocalDate('not-a-date')).toBe(false);
	});
});
