import { describe, expect, it } from 'vitest';

import {
	canonicalWorkoutFields,
	hashWorkoutFields,
	htmlToText,
	inferSport,
	mapIcsEventToWorkout,
	workoutRowToMapped,
	type MappedWorkout
} from './calendarMapping';
import type { ParsedIcsEvent } from '$lib/server/sync/ics';
import type { DbPlannedWorkout } from '$lib/server/repositories/plannedWorkoutsRepository';

function ev(overrides: Partial<ParsedIcsEvent> = {}): ParsedIcsEvent {
	return {
		uid: 'u@test',
		recurrenceId: '',
		summary: 'Workout',
		description: null,
		scheduledDate: '2026-06-10',
		durationSec: 3600,
		sequence: 0,
		lastModified: null,
		cancelled: false,
		...overrides
	};
}

describe('inferSport', () => {
	it('matches sport keywords in title or description', () => {
		expect(inferSport('Pool swim 2000m', null)).toBe('Swim');
		expect(inferSport('Z2 ride 90min', null)).toBe('Bike');
		expect(inferSport('5k tempo run', null)).toBe('Run');
		expect(inferSport('Strength + core', null)).toBe('Strength');
		expect(inferSport('Session', 'Easy spin on the trainer')).toBe('Bike');
	});

	it('falls back to Other when nothing matches', () => {
		expect(inferSport('Recovery day', 'take it easy')).toBe('Other');
	});
});

describe('htmlToText', () => {
	it('passes plain text through unchanged', () => {
		expect(htmlToText('Easy run, zone 2')).toBe('Easy run, zone 2');
	});

	it('strips tags, keeps anchor text (drops the URL), and turns <br> into newlines', () => {
		const html =
			'<b><u>Warm Up:</u></b>🔥<br>(10m per drill) <br>' +
			'<a href="https://example.com/x?a=1&b=2" target="_blank"><u>Open &amp; Close the gate</u></a><br>Swoops';
		expect(htmlToText(html)).toBe('Warm Up:🔥\n(10m per drill)\nOpen & Close the gate\nSwoops');
	});

	it('decodes named and numeric entities', () => {
		expect(htmlToText('3 &lt; 5 &amp; rest&#39;s done &#x263A;')).toBe("3 < 5 & rest's done ☺");
	});

	it('collapses runs of blank lines from block tags', () => {
		expect(htmlToText('A<br><br><br>B')).toBe('A\n\nB');
	});

	it('feeds clean text into the mapped description (no HTML stored)', () => {
		const mapped = mapIcsEventToWorkout(
			ev({ summary: '<b>Track</b> session', description: 'Run:<br><a href="http://x">Gold: 5mi</a>' })
		);
		expect(mapped.title).toBe('Track session');
		expect(mapped.description).toBe('Run:\nGold: 5mi');
		expect(mapped.description).not.toMatch(/[<>]/);
	});
});

describe('mapIcsEventToWorkout', () => {
	it('maps fields and reuses fallbackLoadScore for TSS', () => {
		const mapped = mapIcsEventToWorkout(ev({ summary: 'Easy run', durationSec: 3600 }));
		expect(mapped.sport).toBe('Run');
		expect(mapped.title).toBe('Easy run');
		expect(mapped.scheduledDate).toBe('2026-06-10');
		expect(mapped.plannedDurationSec).toBe(3600);
		// Run factor 0.7 → 1h * 0.7 * 100 = 70.
		expect(mapped.plannedLoad).toBe(70);
		expect(mapped.plannedDistanceM).toBeNull();
	});

	it('leaves load null when there is no duration', () => {
		const mapped = mapIcsEventToWorkout(ev({ durationSec: null }));
		expect(mapped.plannedDurationSec).toBeNull();
		expect(mapped.plannedLoad).toBeNull();
	});

	it('truncates an over-long title to 120 chars', () => {
		const mapped = mapIcsEventToWorkout(ev({ summary: 'x'.repeat(200) }));
		expect(mapped.title.length).toBe(120);
	});
});

describe('hashWorkoutFields', () => {
	const base: MappedWorkout = {
		sport: 'Run',
		scheduledDate: '2026-06-10',
		title: 'Easy run',
		description: 'zone 2',
		plannedDurationSec: 3600,
		plannedDistanceM: null,
		plannedLoad: 70
	};

	it('is stable across a DB round-trip (mapped vs stored row hash match)', () => {
		const row = {
			id: 'p1',
			userId: 'u1',
			sport: 'Run',
			scheduledDate: '2026-06-10',
			title: 'Easy run',
			description: 'zone 2',
			plannedDurationSec: 3600,
			plannedDistanceM: null,
			plannedLoad: 70,
			structureJson: null,
			createdAt: new Date(),
			updatedAt: new Date()
		} as DbPlannedWorkout;
		expect(hashWorkoutFields(workoutRowToMapped(row))).toBe(hashWorkoutFields(base));
	});

	it('ignores float noise in numeric fields (rounds before hashing)', () => {
		expect(hashWorkoutFields({ ...base, plannedLoad: 70.4 })).toBe(hashWorkoutFields({ ...base, plannedLoad: 70 }));
	});

	it('changes when a managed field changes', () => {
		expect(hashWorkoutFields({ ...base, title: 'Hard run' })).not.toBe(hashWorkoutFields(base));
		expect(hashWorkoutFields({ ...base, plannedDurationSec: 5400 })).not.toBe(hashWorkoutFields(base));
	});

	it('canonical form is order-stable and excludes timestamps', () => {
		expect(canonicalWorkoutFields(base)).toContain('Easy run');
	});
});
