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
