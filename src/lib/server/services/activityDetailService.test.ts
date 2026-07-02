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

	it('buckets HR samples into 5 zones by % of LTHR', () => {
		// lthr = 160, so thresholds at 136/144/152/160 (85/90/95/100%).
		const samples = [
			120, 130,             // Z1 (<136)  -> 2
			138, 140, 142,        // Z2 (136-143) -> 3
			146, 148,             // Z3 (144-151) -> 2
			154, 156, 158,        // Z4 (152-159) -> 3
			165, 170              // Z5 (>=160) -> 2
		];
		const zones = computeHrZones(samples, 160);
		expect(zones.length).toBe(5);
		const total = samples.length;
		expect(zones[0]!.pct).toBe(Math.round((2 / total) * 100));
		expect(zones[1]!.pct).toBe(Math.round((3 / total) * 100));
		expect(zones[2]!.pct).toBe(Math.round((2 / total) * 100));
		expect(zones[3]!.pct).toBe(Math.round((3 / total) * 100));
		expect(zones[4]!.pct).toBe(Math.round((2 / total) * 100));
	});

	it('returns empty when LTHR is not positive', () => {
		expect(computeHrZones([120, 140, 160], 0)).toEqual([]);
	});
});
