import { listAllActivitiesForUser } from '$lib/server/repositories/activitiesRepository';
import { upsertActivityStreamMetrics } from '$lib/server/repositories/activityStreamMetricsRepository';
import { readStreamBlob } from '$lib/server/services/fileStorageService';
import {
	computeActivityStreamMetrics,
	serializeStreamMetrics
} from '$lib/server/services/analytics/streamAggregates';

/**
 * (Re)compute and persist per-activity stream metrics for every activity a user
 * owns, at the current algorithm version. Reads each stream blob once — off the
 * request path — so the dashboard never has to. Idempotent (upserts); doubles as
 * the "bumped STREAM_METRICS_VERSION, recompute everyone" tool. Activities whose
 * stream blob is missing/corrupt are skipped and counted.
 */
export async function rebuildActivityStreamMetricsForUser(
	userId: string
): Promise<{ processed: number; skipped: number }> {
	const activities = await listAllActivitiesForUser(userId);
	let processed = 0;
	let skipped = 0;

	for (const a of activities) {
		if (!a.streamPath) {
			skipped += 1;
			continue;
		}
		try {
			const metrics = computeActivityStreamMetrics(await readStreamBlob(a.id));
			await upsertActivityStreamMetrics({
				activityId: a.id,
				userId,
				...serializeStreamMetrics(metrics)
			});
			processed += 1;
		} catch {
			skipped += 1;
		}
	}

	return { processed, skipped };
}
