// Client-importable presentation helpers for activity-list rows. These were
// previously computed per-row on the server and shipped as extra string fields;
// deriving them in the browser from the raw numbers keeps the payload slim
// (the /activities page ships the user's entire history). Pure + framework-free
// so both the Svelte components and unit tests can import them.

import { distanceFromMeters, distanceLabel, distanceUnit, type Units } from '$lib/units';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Epoch ms → "Mon 6/21". */
export function formatActivityDate(startTimeMs: number): string {
	const d = new Date(startTimeMs);
	return `${DOW[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

/** Seconds → "1:04" (h:mm), or "—" when missing. */
export function formatDuration(durationSec: number | null): string {
	if (!durationSec || durationSec <= 0) return '—';
	const total = Math.round(durationSec / 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return `${h}:${m.toString().padStart(2, '0')}`;
}

/** Intensity factor → "0.84", or "—" when missing. */
export function ifLabel(ifn: number | null): string {
	return ifn !== null ? ifn.toFixed(2) : '—';
}

/** Intensity factor → CSS width percent for the IF bar, clamped to 0–120%. */
export function ifPctWidth(ifn: number | null): string {
	return `${Math.max(0, Math.min(120, Math.round((ifn ?? 0) * 100)))}%`;
}

/** Average HR → "152", or "—" when missing. */
export function hrLabel(avgHr: number | null): string {
	return avgHr ? String(Math.round(avgHr)) : '—';
}

// Distance helpers re-exported so components can format from raw meters + the
// user's unit preference without reaching into `$lib/units` directly.
export { distanceFromMeters, distanceLabel, distanceUnit };
export type { Units };
