// See https://svelte.dev/docs/kit/types#app
declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				email: string;
				displayName: string | null;
				role: 'athlete' | 'coach' | 'admin';
			} | null;
			userPrefs: {
				ftpWatts: number | null;
				thresholdHrBpm: number | null;
				maxHrBpm: number | null;
				thresholdPaceSecPerKm: number | null;
				units: 'metric' | 'imperial';
				weekStart: 'mon' | 'sun';
			} | null;
			sessionTokenHash: string | null;
		}
	}
}

export {};
