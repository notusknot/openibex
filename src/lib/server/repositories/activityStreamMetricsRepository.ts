import { inArray } from 'drizzle-orm';

import { getDb } from '$lib/server/db/client';
import { activityStreamMetrics } from '$lib/server/db/schema';

export type DbActivityStreamMetrics = typeof activityStreamMetrics.$inferSelect;

export type StreamMetricsRowInput = {
	activityId: string;
	userId: string;
	version: number;
	hrHistogramJson: string | null;
	powerCurveJson: string | null;
};

/** Build the insert/upsert row (applies timestamps). Shared so the atomic
 *  import commit writes the exact same shape inside its transaction. */
export function streamMetricsValues(input: StreamMetricsRowInput) {
	const now = new Date();
	return {
		activityId: input.activityId,
		userId: input.userId,
		version: input.version,
		hrHistogramJson: input.hrHistogramJson,
		powerCurveJson: input.powerCurveJson,
		createdAt: now,
		updatedAt: now
	};
}

/** Insert or replace one activity's stream metrics (lazy self-heal + backfill). */
export async function upsertActivityStreamMetrics(input: StreamMetricsRowInput): Promise<void> {
	const db = getDb();
	const values = streamMetricsValues(input);
	db.insert(activityStreamMetrics)
		.values(values)
		.onConflictDoUpdate({
			target: activityStreamMetrics.activityId,
			set: {
				version: values.version,
				hrHistogramJson: values.hrHistogramJson,
				powerCurveJson: values.powerCurveJson,
				updatedAt: values.updatedAt
			}
		})
		.run();
}

/** Fetch metrics rows for a set of activity ids (empty in → empty out). */
export async function getStreamMetricsForActivityIds(
	activityIds: string[]
): Promise<DbActivityStreamMetrics[]> {
	if (activityIds.length === 0) return [];
	const db = getDb();
	return db
		.select()
		.from(activityStreamMetrics)
		.where(inArray(activityStreamMetrics.activityId, activityIds))
		.all();
}
