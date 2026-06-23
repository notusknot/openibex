import { countFailingSyncJobs, pingDatabase } from '$lib/server/repositories/healthRepository';
import { criticalWorkCount } from '$lib/server/shutdown';

export type HealthReport = {
	ok: boolean;
	db: 'up';
	uptimeSeconds: number;
	/** In-flight critical writes (e.g. a sync) — the graceful-shutdown drain. */
	inFlightWrites: number;
	/** Aggregate count of users whose sync is failed / in cool-down. */
	syncFailing: number;
};

export async function getHealth(): Promise<HealthReport> {
	await pingDatabase(); // throws if the DB is unreachable
	return {
		ok: true,
		db: 'up',
		uptimeSeconds: Math.round(process.uptime()),
		inFlightWrites: criticalWorkCount(),
		syncFailing: countFailingSyncJobs()
	};
}
