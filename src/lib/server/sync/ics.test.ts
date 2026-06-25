import { describe, expect, it } from 'vitest';

import { assertSafePublicUrl, parseIcsEvents } from './ics';

// Window wide enough to include every fixture event (all in 2026).
const WIDE = {
	windowStartMs: Date.UTC(2020, 0, 1),
	windowEndMs: Date.UTC(2030, 0, 1),
	maxOccurrences: 500
};

function ics(...vevents: string[]): string {
	return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', ...vevents, 'END:VCALENDAR'].join('\n');
}

const SIMPLE = [
	'BEGIN:VEVENT',
	'UID:simple@test',
	'DTSTAMP:20260101T000000Z',
	'DTSTART:20260610T170000Z',
	'DTEND:20260610T183000Z',
	'SUMMARY:Pool swim 2000m',
	'DESCRIPTION:warmup then 8x100',
	'SEQUENCE:2',
	'END:VEVENT'
].join('\n');

describe('parseIcsEvents — single events', () => {
	it('parses a basic event with date, duration, and metadata', () => {
		const { events, failed } = parseIcsEvents(ics(SIMPLE), WIDE);
		expect(failed).toBe(0);
		expect(events).toHaveLength(1);
		const e = events[0]!;
		expect(e.uid).toBe('simple@test');
		expect(e.recurrenceId).toBe('');
		expect(e.summary).toBe('Pool swim 2000m');
		expect(e.scheduledDate).toBe('2026-06-10');
		expect(e.durationSec).toBe(90 * 60);
		expect(e.sequence).toBe(2);
		expect(e.cancelled).toBe(false);
	});

	it('marks STATUS:CANCELLED events', () => {
		const cancelled = [
			'BEGIN:VEVENT',
			'UID:cx@test',
			'DTSTART:20260612T170000Z',
			'DTEND:20260612T180000Z',
			'STATUS:CANCELLED',
			'SUMMARY:Cancelled session',
			'END:VEVENT'
		].join('\n');
		const { events } = parseIcsEvents(ics(cancelled), WIDE);
		expect(events).toHaveLength(1);
		expect(events[0]!.cancelled).toBe(true);
	});

	it('skips a malformed event (no DTSTART) but keeps the good ones', () => {
		const bad = ['BEGIN:VEVENT', 'UID:bad@test', 'SUMMARY:no start', 'END:VEVENT'].join('\n');
		const { events, failed } = parseIcsEvents(ics(bad, SIMPLE), WIDE);
		expect(failed).toBeGreaterThanOrEqual(1);
		expect(events.map((e) => e.uid)).toContain('simple@test');
	});

	it('excludes events outside the window', () => {
		const narrow = { windowStartMs: Date.UTC(2026, 5, 1), windowEndMs: Date.UTC(2026, 5, 5), maxOccurrences: 500 };
		// SIMPLE is on 2026-06-10, outside [Jun 1, Jun 5].
		expect(parseIcsEvents(ics(SIMPLE), narrow).events).toHaveLength(0);
	});
});

describe('parseIcsEvents — recurrence', () => {
	const weekly = [
		'BEGIN:VEVENT',
		'UID:weekly@test',
		'DTSTART:20260601T170000Z',
		'DTEND:20260601T180000Z',
		'RRULE:FREQ=WEEKLY;COUNT=3',
		'SUMMARY:Tuesday intervals',
		'END:VEVENT'
	].join('\n');

	it('expands an RRULE into one event per occurrence with distinct recurrence ids', () => {
		const { events } = parseIcsEvents(ics(weekly), WIDE);
		const dates = events.filter((e) => e.uid === 'weekly@test').map((e) => e.scheduledDate);
		expect(dates).toEqual(['2026-06-01', '2026-06-08', '2026-06-15']);
		const recIds = new Set(events.map((e) => e.recurrenceId));
		expect(recIds.size).toBe(3); // each occurrence keyed distinctly
	});

	it('applies a RECURRENCE-ID override to a single instance', () => {
		const override = [
			'BEGIN:VEVENT',
			'UID:weekly@test',
			'RECURRENCE-ID:20260608T170000Z',
			'DTSTART:20260608T170000Z',
			'DTEND:20260608T173000Z',
			'SUMMARY:Tuesday intervals (shortened)',
			'END:VEVENT'
		].join('\n');
		const { events } = parseIcsEvents(ics(weekly, override), WIDE);
		const jun8 = events.find((e) => e.scheduledDate === '2026-06-08');
		expect(jun8?.summary).toBe('Tuesday intervals (shortened)');
		expect(jun8?.durationSec).toBe(30 * 60);
	});

	it('honors EXDATE by dropping the excluded instance', () => {
		const withEx = [
			'BEGIN:VEVENT',
			'UID:weekly@test',
			'DTSTART:20260601T170000Z',
			'DTEND:20260601T180000Z',
			'RRULE:FREQ=WEEKLY;COUNT=3',
			'EXDATE:20260608T170000Z',
			'SUMMARY:Tuesday intervals',
			'END:VEVENT'
		].join('\n');
		const dates = parseIcsEvents(ics(withEx), WIDE).events.map((e) => e.scheduledDate);
		expect(dates).toEqual(['2026-06-01', '2026-06-15']);
	});

	it('caps the number of expanded occurrences', () => {
		const daily = [
			'BEGIN:VEVENT',
			'UID:daily@test',
			'DTSTART:20260101T170000Z',
			'DTEND:20260101T180000Z',
			'RRULE:FREQ=DAILY',
			'SUMMARY:Daily',
			'END:VEVENT'
		].join('\n');
		const { events } = parseIcsEvents(ics(daily), { windowStartMs: Date.UTC(2026, 0, 1), windowEndMs: Date.UTC(2030, 0, 1), maxOccurrences: 10 });
		expect(events.length).toBe(10);
	});
});

describe('assertSafePublicUrl (SSRF guard)', () => {
	it('rejects non-https schemes', async () => {
		await expect(assertSafePublicUrl('http://example.com/feed.ics')).rejects.toThrow(/https/i);
	});

	it('rejects loopback / private / link-local / metadata addresses', async () => {
		await expect(assertSafePublicUrl('https://127.0.0.1/x')).rejects.toThrow();
		await expect(assertSafePublicUrl('https://10.0.0.5/x')).rejects.toThrow();
		await expect(assertSafePublicUrl('https://192.168.1.10/x')).rejects.toThrow();
		await expect(assertSafePublicUrl('https://169.254.169.254/latest/meta-data')).rejects.toThrow();
		await expect(assertSafePublicUrl('https://[::1]/x')).rejects.toThrow();
		await expect(assertSafePublicUrl('https://localhost/x')).rejects.toThrow();
	});

	it('accepts a public IP literal', async () => {
		// IP literal → no DNS; 93.184.x is public, so it passes the guard.
		await expect(assertSafePublicUrl('https://93.184.216.34/feed.ics')).resolves.toBeInstanceOf(URL);
	});
});
