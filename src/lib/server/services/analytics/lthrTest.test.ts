import { describe, it, expect } from 'vitest';
import { interpretLthrTest } from './lthrTest';

// Build a synthetic test: `warm` easy seconds, `hold` seconds at `effort`, then
// `cool` easy seconds — the shape of a real 30-min TT recording.
function session(warm: number, hold: number, cool: number, easy: number, effort: number): number[] {
	return [
		...Array<number>(warm).fill(easy),
		...Array<number>(hold).fill(effort),
		...Array<number>(cool).fill(easy)
	];
}

describe('interpretLthrTest', () => {
	it('detects LTHR as the best 20-min window and locates the effort', () => {
		// 5 min easy @120, 20 min hold @168, 5 min easy @120.
		const s = session(300, 1200, 300, 120, 168);
		const r = interpretLthrTest(s);
		expect(r.lthr).toBe(168);
		expect(r.segmentStartSec).toBe(300); // the hold begins at 5:00
		expect(r.segmentEndSec).toBe(1500);
		expect(r.looksMaximal).toBe(true);
	});

	it('flags an easy ride as not maximal', () => {
		const s = Array<number>(1800).fill(120); // 30 min steady easy, no hard block
		const r = interpretLthrTest(s);
		expect(r.lthr).toBe(120); // still computes a number...
		expect(r.looksMaximal).toBe(false); // ...but warns
	});

	it('returns null LTHR when under 20 min of HR', () => {
		const r = interpretLthrTest(Array<number>(600).fill(160));
		expect(r.hasHr).toBe(true);
		expect(r.lthr).toBeNull();
		expect(r.looksMaximal).toBe(false);
	});

	it('has no HR when the stream is empty', () => {
		const r = interpretLthrTest([]);
		expect(r.hasHr).toBe(false);
		expect(r.hrSeconds).toBe(0);
	});
});
