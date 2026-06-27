// Re-export the sport display maps from the client-importable `$lib/sport` so
// server services keep their existing `$lib/server/sport` import path while the
// maps themselves live in one shared module (also used by browser components).
export { SPORT_DISPLAY, SPORT_COLOR_VAR, SPORT_TAG } from '$lib/sport';
export type { Sport as SportName, SportKey } from '$lib/sport';
