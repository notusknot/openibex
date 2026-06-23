import { describe, expect, it } from 'vitest';

import { selectActivitiesToImport } from '$lib/server/services/sync/syncService';
import type { GarminActivityRef } from '$lib/server/sync/garmin';

function ref(activityId: number, startTimeMs: number): GarminActivityRef {
	return { activityId, startTimeMs, activityName: null };
}

// Garmin returns newest-first.
const NEWEST_FIRST = [ref(5, 5000), ref(4, 4000), ref(3, 3000), ref(2, 2000), ref(1, 1000)];

describe('selectActivitiesToImport', () => {
	it('first run (no cursor) caps at initialLimit, oldest-first', () => {
		const out = selectActivitiesToImport(NEWEST_FIRST, null, 3);
		expect(out.map((a) => a.activityId)).toEqual([3, 4, 5]); // newest 3, returned oldest-first
	});

	it('incremental run returns only activities strictly newer than the cursor', () => {
		const out = selectActivitiesToImport(NEWEST_FIRST, 3000, 30);
		expect(out.map((a) => a.activityId)).toEqual([4, 5]);
	});

	it('excludes the activity exactly at the cursor (already imported)', () => {
		const out = selectActivitiesToImport(NEWEST_FIRST, 5000, 30);
		expect(out).toEqual([]);
	});

	it('returns everything oldest-first when the cursor predates all activities', () => {
		const out = selectActivitiesToImport(NEWEST_FIRST, 0, 30);
		expect(out.map((a) => a.activityId)).toEqual([1, 2, 3, 4, 5]);
	});

	it('handles an empty activity list', () => {
		expect(selectActivitiesToImport([], null, 30)).toEqual([]);
		expect(selectActivitiesToImport([], 1000, 30)).toEqual([]);
	});
});
