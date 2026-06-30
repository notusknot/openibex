import { getEnv } from '$lib/server/env';

// Server-side "local day" computation. Activity start_time is stored as a UTC
// instant; the dashboard/calendar bucket activities by the athlete's LOCAL
// calendar day. Done naively with Date.getHours()/setHours() that day is the
// SERVER process's zone — which on a default Docker host is UTC, so a UTC-7
// athlete's evening workout drifts to the next day (wrong daily TSS cell, wrong
// week, failed auto-match).
//
// `OPENIBEX_TZ` (an IANA zone like "America/Los_Angeles") makes the app's local
// day explicit and independent of the container's clock. When it is UNSET these
// helpers fall back to the process zone, so default behavior is unchanged.
//
// (The client formats dates in the browser's own zone — already the athlete's —
// so this is server-only; see $lib/validation/localDate.formatLocalDate.)

export function appTimeZone(): string | undefined {
	return getEnv().OPENIBEX_TZ;
}

/** 'YYYY-MM-DD' for `date` in `tz` (process zone when tz is undefined). */
export function localDayKey(date: Date, tz: string | undefined = appTimeZone()): string {
	if (!tz) {
		const y = String(date.getFullYear()).padStart(4, '0');
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	// en-CA renders ISO-style YYYY-MM-DD regardless of host locale.
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}

// Wall-clock offset (ms) of `tz` at `date`: (the local Y/M/D h:m:s read as UTC)
// minus the actual UTC instant. Used to map a local midnight back to its instant.
function tzOffsetMs(date: Date, tz: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hour12: false,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(date);
	const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
	let hour = get('hour');
	if (hour === 24) hour = 0; // some engines emit '24' for midnight
	const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
	return asUtc - date.getTime();
}

/** The instant of local midnight (00:00 in `tz`) for the calendar day holding
 * `date`. Process zone when tz is undefined (matches the old `setHours(0,…)`). */
export function startOfLocalDay(date: Date, tz: string | undefined = appTimeZone()): Date {
	if (!tz) {
		const out = new Date(date);
		out.setHours(0, 0, 0, 0);
		return out;
	}
	const p = localDayKey(date, tz).split('-');
	const utcGuess = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0);
	const offset = tzOffsetMs(new Date(utcGuess), tz);
	return new Date(utcGuess - offset);
}

/** Inclusive [from, to] instants spanning the local calendar day named by a
 * 'YYYY-MM-DD' string. Process zone when tz is undefined. */
export function dayBoundsFromKey(
	dayKey: string,
	tz: string | undefined = appTimeZone()
): { from: Date; to: Date } {
	const p = dayKey.split('-');
	const y = Number(p[0]);
	const m = Number(p[1]);
	const d = Number(p[2]);
	if (!tz) {
		return {
			from: new Date(y, m - 1, d, 0, 0, 0, 0),
			to: new Date(y, m - 1, d, 23, 59, 59, 999)
		};
	}
	const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
	const offset = tzOffsetMs(new Date(utcGuess), tz);
	const from = new Date(utcGuess - offset);
	return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1) };
}
