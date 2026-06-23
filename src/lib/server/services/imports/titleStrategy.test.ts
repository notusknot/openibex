import { describe, expect, it } from 'vitest';

import type { GarminMetadataLookup } from '$lib/server/services/imports/garminMetadata';
import { composeSmartTitle } from '$lib/server/services/imports/titleStrategy';

function makeLookup(entries: { startTimeGmtMs: number; sportType: string; name: string }[]): GarminMetadataLookup {
	const byStartMinute = new Map<number, Array<{ activityId: string; name: string; sportType: string; startTimeGmtMs: number }>>();
	for (const e of entries) {
		const minute = Math.round(e.startTimeGmtMs / 60000) * 60000;
		const list = byStartMinute.get(minute) ?? [];
		list.push({ activityId: `${minute}`, name: e.name, sportType: e.sportType, startTimeGmtMs: e.startTimeGmtMs });
		byStartMinute.set(minute, list);
	}
	return { totalActivities: entries.length, byActivityId: new Map(), byStartMinute };
}

describe('composeSmartTitle', () => {
	it('uses the Garmin metadata name when a fingerprint matches', () => {
		const t = new Date('2026-06-21T17:52:00Z');
		const lookup = makeLookup([
			{ startTimeGmtMs: t.getTime(), sportType: 'RUNNING', name: 'Pleasanton Running' }
		]);
		expect(composeSmartTitle({ metadataLookup: lookup, sport: 'Run', startTime: t })).toBe('Pleasanton Running');
	});

	it('falls back to time-of-day + sport when no metadata match', () => {
		const lookup = makeLookup([]);
		const morning = new Date(2026, 5, 21, 6, 30); // local 6:30 AM
		expect(composeSmartTitle({ metadataLookup: lookup, sport: 'Run', startTime: morning })).toBe('Morning Run');

		const afternoon = new Date(2026, 5, 21, 14, 30); // local 2:30 PM
		expect(composeSmartTitle({ metadataLookup: lookup, sport: 'Bike', startTime: afternoon })).toBe('Afternoon Bike');

		const evening = new Date(2026, 5, 21, 19, 0); // local 7 PM
		expect(composeSmartTitle({ metadataLookup: lookup, sport: 'Swim', startTime: evening })).toBe('Evening Swim');

		const lateNight = new Date(2026, 5, 21, 23, 0); // local 11 PM
		expect(composeSmartTitle({ metadataLookup: lookup, sport: 'Run', startTime: lateNight })).toBe('Night Run');

		const earlyMorning = new Date(2026, 5, 21, 2, 0); // local 2 AM
		expect(composeSmartTitle({ metadataLookup: lookup, sport: 'Run', startTime: earlyMorning })).toBe('Night Run');
	});

	it('uses "Workout" as the noun for Strength and Other', () => {
		const lookup = makeLookup([]);
		const noon = new Date(2026, 5, 21, 12, 0);
		expect(composeSmartTitle({ metadataLookup: lookup, sport: 'Strength', startTime: noon })).toBe('Afternoon Workout');
		expect(composeSmartTitle({ metadataLookup: lookup, sport: 'Other', startTime: noon })).toBe('Afternoon Workout');
	});

	it('falls back to time-of-day when metadataLookup is null', () => {
		const morning = new Date(2026, 5, 21, 6, 0);
		expect(composeSmartTitle({ metadataLookup: null, sport: 'Run', startTime: morning })).toBe('Morning Run');
	});
});
