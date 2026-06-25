import crypto from 'node:crypto';

import type { Sport } from '$lib/server/db/schema';
import type { DbPlannedWorkout } from '$lib/server/repositories/plannedWorkoutsRepository';
import { fallbackLoadScore } from '$lib/server/services/analytics/load';
import type { ParsedIcsEvent } from '$lib/server/sync/ics';

// The repo has no built-in sport-inference / TSS-estimation pipeline for planned
// workouts (they're stored verbatim from the form). This module is the minimal
// "analysis" the brief asks for: infer a sport from the event text, take the
// duration from DTSTART→DTEND, and reuse the app's own `fallbackLoadScore`
// duration→TSS heuristic. Free-text interval structure is intentionally NOT
// parsed (out of scope for now).

/** The subset of planned-workout fields this feature manages. Hashing this tuple
 * (via {@link hashWorkoutFields}) is how we detect both upstream changes and user
 * edits without intercepting the edit UI. */
export type MappedWorkout = {
	sport: Sport;
	scheduledDate: string;
	title: string;
	description: string | null;
	plannedDurationSec: number | null;
	plannedDistanceM: number | null;
	plannedLoad: number | null;
};

const SPORT_PATTERNS: Array<{ sport: Sport; re: RegExp }> = [
	// Order matters — most specific first. A "pool swim" must beat a generic match.
	{ sport: 'Swim', re: /\b(swim|swimming|pool|freestyle|backstroke|breaststroke|swm)\b/i },
	{ sport: 'Bike', re: /\b(bike|biking|bicycle|cycle|cycling|ride|spin|trainer|zwift|watt|watts|ftp)\b/i },
	{ sport: 'Run', re: /\b(run|running|jog|jogging|tempo|track|interval|intervals|fartlek|5k|10k|marathon)\b/i },
	{ sport: 'Strength', re: /\b(strength|gym|lift|lifting|weights|squat|deadlift|bench|core|mobility|yoga|pilates)\b/i }
];

// A handful of named HTML entities common in calendar text. Numeric entities
// (&#39; / &#x27;) are handled generically below.
const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	mdash: '—',
	ndash: '–',
	hellip: '…',
	lsquo: '‘',
	rsquo: '’',
	ldquo: '“',
	rdquo: '”'
};

function decodeEntities(s: string): string {
	return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, body: string) => {
		if (body[0] === '#') {
			const code = /^#x/i.test(body) ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
			return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
		}
		const named = NAMED_ENTITIES[body.toLowerCase()];
		return named ?? m;
	});
}

/**
 * Reduce HTML to plain text. Google Calendar puts rich HTML (links, bold,
 * <br>) in event descriptions; we only want the readable text. Tags are
 * dropped (anchor text is kept, the URL discarded), <br>/block ends become
 * newlines, and entities are decoded. Plain text passes through unchanged.
 * Deliberately a tiny regex pass — no HTML-parser dependency.
 */
export function htmlToText(input: string): string {
	if (!input) return '';
	const text = decodeEntities(
		input
			.replace(/<\s*br\s*\/?\s*>/gi, '\n')
			.replace(/<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
			.replace(/<[^>]+>/g, '')
	);
	// Tidy: drop trailing spaces per line, collapse runs of blank lines.
	return text
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** Best-effort sport from the event title + description. Falls back to 'Other'. */
export function inferSport(title: string, description: string | null): Sport {
	const hay = `${title} ${description ?? ''}`;
	for (const { sport, re } of SPORT_PATTERNS) {
		if (re.test(hay)) return sport;
	}
	return 'Other';
}

/** Map a parsed ICS event to the planned-workout fields. Numbers are rounded to
 * integers so the stored value and its hash are stable across re-reads. */
export function mapIcsEventToWorkout(ev: ParsedIcsEvent): MappedWorkout {
	// Strip any HTML the feed carries — titles collapse to a single line,
	// descriptions keep their line breaks.
	const title = (htmlToText(ev.summary).replace(/\s+/g, ' ').trim() || 'Untitled workout').slice(0, 120);
	const descText = htmlToText(ev.description ?? '');
	const description = descText.length > 0 ? descText : null;
	const sport = inferSport(title, description);
	const plannedDurationSec =
		ev.durationSec !== null && ev.durationSec > 0 ? Math.round(ev.durationSec) : null;
	const loadRaw = fallbackLoadScore({ sport, durationSec: plannedDurationSec });
	const plannedLoad = loadRaw !== null ? Math.round(loadRaw) : null;
	return {
		sport,
		scheduledDate: ev.scheduledDate,
		title,
		description,
		// Distance isn't reliably derivable from free text — left for the user.
		plannedDistanceM: null,
		plannedDurationSec,
		plannedLoad
	};
}

/** The current managed fields of a stored planned workout, for change detection. */
export function workoutRowToMapped(row: DbPlannedWorkout): MappedWorkout {
	return {
		sport: row.sport,
		scheduledDate: row.scheduledDate,
		title: row.title,
		description: row.description ?? null,
		plannedDurationSec: row.plannedDurationSec ?? null,
		plannedDistanceM: row.plannedDistanceM ?? null,
		plannedLoad: row.plannedLoad ?? null
	};
}

function numKey(n: number | null): string {
	return n === null ? '' : String(Math.round(n));
}

/** Canonical, order-stable string form of the managed fields. Numbers are
 * rounded so float noise (e.g. a recomputed load) never flips the hash. */
export function canonicalWorkoutFields(w: MappedWorkout): string {
	return JSON.stringify([
		w.sport,
		w.scheduledDate,
		w.title.trim(),
		(w.description ?? '').trim(),
		numKey(w.plannedDurationSec),
		numKey(w.plannedDistanceM),
		numKey(w.plannedLoad)
	]);
}

/** Stable content hash of the managed fields — the single signal used to tell
 * "upstream changed" and "user edited" apart in reconciliation. */
export function hashWorkoutFields(w: MappedWorkout): string {
	return crypto.createHash('sha256').update(canonicalWorkoutFields(w)).digest('hex');
}
