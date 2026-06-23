import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { activities, type Sport } from '$lib/server/db/schema';

export type DbActivity = typeof activities.$inferSelect;

export async function createActivity(input: {
	id: string;
	userId: string;
	activityFileId: string | null;
	source?: string | null;
	sourceActivityId?: string | null;
	sourceFileSha256?: string | null;
	sourceFilename?: string | null;
	importedAt?: Date | null;
	sport: Sport;
	title: string;
	description?: string | null;
	startTime: Date;
	timezone?: string | null;
	durationSec?: number | null;
	movingTimeSec?: number | null;
	distanceM?: number | null;
	elevationGainM?: number | null;
	avgHr?: number | null;
	maxHr?: number | null;
	avgPowerW?: number | null;
	maxPowerW?: number | null;
	normalizedPowerLikeW?: number | null;
	avgCadence?: number | null;
	calories?: number | null;
	loadScore?: number | null;
	streamPath?: string | null;
	parserVersion?: string | null;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.insert(activities)
		.values({
			id: input.id,
			userId: input.userId,
			activityFileId: input.activityFileId,
			source: input.source ?? null,
			sourceActivityId: input.sourceActivityId ?? null,
			sourceFileSha256: input.sourceFileSha256 ?? null,
			sourceFilename: input.sourceFilename ?? null,
			importedAt: input.importedAt ?? null,
			sport: input.sport,
			title: input.title,
			description: input.description ?? null,
			startTime: input.startTime,
			timezone: input.timezone ?? null,
			durationSec: input.durationSec ?? null,
			movingTimeSec: input.movingTimeSec ?? null,
			distanceM: input.distanceM ?? null,
			elevationGainM: input.elevationGainM ?? null,
			avgHr: input.avgHr ?? null,
			maxHr: input.maxHr ?? null,
			avgPowerW: input.avgPowerW ?? null,
			maxPowerW: input.maxPowerW ?? null,
			normalizedPowerLikeW: input.normalizedPowerLikeW ?? null,
			avgCadence: input.avgCadence ?? null,
			calories: input.calories ?? null,
			loadScore: input.loadScore ?? null,
			streamPath: input.streamPath ?? null,
			parserVersion: input.parserVersion ?? null,
			createdAt: now,
			updatedAt: now
		})
		.run();
}

export async function getActivityByIdForUser(id: string, userId: string): Promise<DbActivity | undefined> {
	const db = getDb();
	return db
		.select()
		.from(activities)
		.where(and(eq(activities.id, id), eq(activities.userId, userId)))
		.get();
}

export async function getActivityBySourceFileShaForUser(input: {
	userId: string;
	sha256: string;
}): Promise<DbActivity | undefined> {
	const db = getDb();
	return db
		.select()
		.from(activities)
		.where(and(eq(activities.userId, input.userId), eq(activities.sourceFileSha256, input.sha256)))
		.get();
}

export async function getActivityBySourceActivityIdForUser(input: {
	userId: string;
	source: string;
	sourceActivityId: string;
}): Promise<DbActivity | undefined> {
	const db = getDb();
	return db
		.select()
		.from(activities)
		.where(
			and(
				eq(activities.userId, input.userId),
				eq(activities.source, input.source),
				eq(activities.sourceActivityId, input.sourceActivityId)
			)
		)
		.get();
}

export async function getActivityByFingerprintForUser(input: {
	userId: string;
	sport: Sport;
	startTime: Date;
	durationSec: number | null;
	distanceM: number | null;
}): Promise<DbActivity | undefined> {
	const db = getDb();
	const where = [
		eq(activities.userId, input.userId),
		eq(activities.sport, input.sport),
		eq(activities.startTime, input.startTime)
	];
	where.push(input.durationSec === null ? isNull(activities.durationSec) : eq(activities.durationSec, input.durationSec));
	where.push(input.distanceM === null ? isNull(activities.distanceM) : eq(activities.distanceM, input.distanceM));
	return db
		.select()
		.from(activities)
		.where(and(...where))
		.get();
}

export async function listRecentActivitiesForUser(userId: string, limit: number): Promise<DbActivity[]> {
	const db = getDb();
	return db
		.select()
		.from(activities)
		.where(eq(activities.userId, userId))
		.orderBy(desc(activities.startTime))
		.limit(limit)
		.all();
}

export async function listAllActivitiesForUser(userId: string): Promise<DbActivity[]> {
	const db = getDb();
	return db.select().from(activities).where(eq(activities.userId, userId)).all();
}

export async function listActivitiesForUserInTimeRange(input: {
	userId: string;
	from: Date;
	to: Date;
}): Promise<DbActivity[]> {
	const db = getDb();
	return db
		.select()
		.from(activities)
		.where(
			and(
				eq(activities.userId, input.userId),
				gte(activities.startTime, input.from),
				lte(activities.startTime, input.to)
			)
		)
		.orderBy(desc(activities.startTime))
		.all();
}

export async function countActivitiesForUser(userId: string): Promise<number> {
	const db = getDb();
	const row = db
		.select({ c: sql<number>`count(*)` })
		.from(activities)
		.where(eq(activities.userId, userId))
		.get();
	return row?.c ?? 0;
}

export async function sumActivitiesForUserInTimeRange(input: {
	userId: string;
	from: Date;
	to: Date;
}): Promise<{ loadSum: number; durationSecSum: number; distanceMSum: number }> {
	const db = getDb();
	const row = db
		.select({
			loadSum: sql<number>`coalesce(sum(${activities.loadScore}), 0)`,
			durationSecSum: sql<number>`coalesce(sum(${activities.durationSec}), 0)`,
			distanceMSum: sql<number>`coalesce(sum(${activities.distanceM}), 0)`
		})
		.from(activities)
		.where(
			and(
				eq(activities.userId, input.userId),
				gte(activities.startTime, input.from),
				lte(activities.startTime, input.to)
			)
		)
		.get();
	return row ?? { loadSum: 0, durationSecSum: 0, distanceMSum: 0 };
}

export async function updateActivityTitleForUser(input: {
	id: string;
	userId: string;
	title: string;
}): Promise<void> {
	const db = getDb();
	db.update(activities)
		.set({ title: input.title, updatedAt: new Date() })
		.where(and(eq(activities.id, input.id), eq(activities.userId, input.userId)))
		.run();
}

export async function listActivitiesForUserOnDateAndSport(input: {
	userId: string;
	date: string; // YYYY-MM-DD (interpreted in server-local time)
	sport: Sport;
}): Promise<DbActivity[]> {
	const from = new Date(`${input.date}T00:00:00`);
	const to = new Date(`${input.date}T23:59:59.999`);
	const db = getDb();
	return db
		.select()
		.from(activities)
		.where(
			and(
				eq(activities.userId, input.userId),
				eq(activities.sport, input.sport),
				gte(activities.startTime, from),
				lte(activities.startTime, to)
			)
		)
		.orderBy(desc(activities.startTime))
		.all();
}
