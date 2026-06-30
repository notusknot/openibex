// Sport display maps — the single source of truth for how a sport renders
// (display bucket, badge text, accent color). Lives outside `server/` so both
// server services and browser components can import it; the slim activity-list
// rows ship only the raw `sportLabel`, and the client derives tag/color here
// instead of paying for those strings on every row.

/** The schema's Sport enum values, duplicated here so this module stays
 *  client-importable (no `$lib/server` dependency). Keep in sync with
 *  `sports` in `$lib/server/db/schema.ts`. */
export type Sport = 'Swim' | 'Bike' | 'Run' | 'Strength' | 'Other';

/** Runtime sport list for client/route use (dropdowns), so routes don't reach
 *  into the Drizzle schema module just for the enum. Same order as
 *  `sports` in `$lib/server/db/schema.ts`; keep the two in sync. */
export const SPORTS = ['Bike', 'Run', 'Swim', 'Strength', 'Other'] as const;

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
