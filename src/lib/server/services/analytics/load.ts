import type { Sport } from '$lib/server/db/schema';

const intensityFactorBySport: Record<Sport, number> = {
	Bike: 0.6,
	Run: 0.7,
	Swim: 0.65,
	Strength: 0.5,
	Other: 0.5
};

export function fallbackLoadScore(input: { sport: Sport; durationSec: number | null }): number | null {
	if (input.durationSec === null) return null;
	const hours = input.durationSec / 3600;
	const factor = intensityFactorBySport[input.sport] ?? 0.5;
	return hours * factor * 100;
}

