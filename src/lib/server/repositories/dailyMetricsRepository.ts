import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

import { getDb } from '$lib/server/db/client';
import { dailyMetrics, type Sport } from '$lib/server/db/schema';

export async function deleteDailyMetricsForUser(userId: string): Promise<void> {
	const db = getDb();
	db.delete(dailyMetrics).where(eq(dailyMetrics.userId, userId)).run();
}

export async function insertDailyMetricsRows(
	userId: string,
	rows: Array<{
		date: string; // YYYY-MM-DD
		sport: Sport | null;
		durationSec: number;
		distanceM: number;
		elevationGainM: number;
		loadScore: number;
	}>
): Promise<void> {
	if (rows.length === 0) return;
	const db = getDb();
	const now = new Date();
	db.insert(dailyMetrics)
		.values(
			rows.map((r) => ({
				id: crypto.randomUUID(),
				userId,
				date: r.date,
				sport: r.sport,
				durationSec: r.durationSec,
				distanceM: r.distanceM,
				elevationGainM: r.elevationGainM,
				loadScore: r.loadScore,
				createdAt: now,
				updatedAt: now
			}))
		)
		.run();
}

