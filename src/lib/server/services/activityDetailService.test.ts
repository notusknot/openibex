import { describe, expect, it } from 'vitest';

import {
	bestSegmentTime,
	computeHrZones
} from '$lib/server/services/activityDetailService';

describe('bestSegmentTime', () => {
	it('returns null when total distance is below the target', () => {
		// 0..300m total, asking for 400m
		const dist = [0, 100, 200, 300];
		const time = [0, 30, 60, 90];
		expect(bestSegmentTime(dist, time, 400)).toBeNull();
	});

	it('finds the fastest contiguous 400m on a record stream with mixed pace', () => {
		// Constant pace 3:00/km segment + faster 2:40/km segment + back to 3:00/km.
		// Each "record" = 100m; assemble cumulative distance + time.
		const dist: number[] = [];
		const time: number[] = [];
		const segments = [
			{ count: 5, secPer100: 18 },   // 500m at 3:00/km
			{ count: 5, secPer100: 16 },   // 500m at 2:40/km (the fast 400m+ is in here)
			{ count: 5, secPer100: 18 }    // 500m at 3:00/km
		];
		let d = 0;
		let t = 0;
		dist.push(d); time.push(t);
		for (const s of segments) {
			for (let i = 0; i < s.count; i++) {
				d += 100;
				t += s.secPer100;
				dist.push(d);
				time.push(t);
			}
		}
		const best = bestSegmentTime(dist, time, 400);
		expect(best).not.toBeNull();
		// 400m at 2:40/km = 64s. Should hit that exactly within the fast segment.
		expect(best).toBeCloseTo(64, 0);
	});

	it('returns null on empty/single-point sequences', () => {
		expect(bestSegmentTime([], [], 100)).toBeNull();
		expect(bestSegmentTime([0], [0], 100)).toBeNull();
	});
});

describe('computeHrZones', () => {
	it('returns empty when no samples', () => {
		expect(computeHrZones([], 180)).toEqual([]);
	});

	it('buckets HR samples into 5 zones by % of maxHr', () => {
		// maxHr = 200, so thresholds at 120/140/160/180 (60/70/80/90%).
		const samples = [
			100, 110,             // Z1 (<120)  -> 2
			125, 130, 135,        // Z2 (120-139) -> 3
			145, 150,             // Z3 (140-159) -> 2
			165, 170, 175,        // Z4 (160-179) -> 3
			185, 195              // Z5 (>=180) -> 2
		];
		const zones = computeHrZones(samples, 200);
		expect(zones.length).toBe(5);
		const total = samples.length;
		expect(zones[0]!.pct).toBe(Math.round((2 / total) * 100));
		expect(zones[1]!.pct).toBe(Math.round((3 / total) * 100));
		expect(zones[2]!.pct).toBe(Math.round((2 / total) * 100));
		expect(zones[3]!.pct).toBe(Math.round((3 / total) * 100));
		expect(zones[4]!.pct).toBe(Math.round((2 / total) * 100));
	});

	it('falls back to max of samples when maxHrHint is missing', () => {
		// No hint -> use max(samples) = 200; everything is <90% so Z5 percentage is small.
		const samples = [120, 140, 160, 180, 200];
		const zones = computeHrZones(samples, null);
		expect(zones.length).toBe(5);
		// 200/200 = 100% => Z5 has 1 sample, Z4 has 1 sample (180/200=90% -> Z5 actually).
		// 60%=120 (Z2), 70%=140 (Z3), 80%=160 (Z4), 90%=180 (Z5), 100%=200 (Z5)
		expect(zones[0]!.pct).toBe(0);
		expect(zones[4]!.pct).toBe(Math.round((2 / 5) * 100));
	});
});
