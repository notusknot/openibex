import type { Sport } from '$lib/server/db/schema';

/** Display key for a sport, used to pick colors / tags / CSS classes. */
export type SportKey = 'swim' | 'bike' | 'run' | 'other';

/** Sport → display key. Strength and Other both fall into the neutral "other"
 *  bucket. Single source shared by the list, calendar, and dashboard services. */
export const SPORT_DISPLAY: Record<Sport, SportKey> = {
	Swim: 'swim',
	Bike: 'bike',
	Run: 'run',
	Strength: 'other',
	Other: 'other'
};

/** Sport → CSS color var for its badge/accent. Strength and Other are neutral. */
export const SPORT_COLOR_VAR: Record<Sport, string> = {
	Swim: 'var(--swim)',
	Bike: 'var(--bike)',
	Run: 'var(--run)',
	Strength: 'var(--muted)',
	Other: 'var(--muted)'
};

/** Sport → uppercase badge text. Keyed by the real sport so Strength reads
 *  "STRENGTH" everywhere (list, detail, calendar), not the generic "OTHER". */
export const SPORT_TAG: Record<Sport, string> = {
	Swim: 'SWIM',
	Bike: 'BIKE',
	Run: 'RUN',
	Strength: 'STRENGTH',
	Other: 'OTHER'
};
