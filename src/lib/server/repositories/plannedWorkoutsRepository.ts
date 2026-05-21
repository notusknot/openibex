import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { plannedWorkouts, type Sport } from '$lib/server/db/schema';

export type DbPlannedWorkout = typeof plannedWorkouts.$inferSelect;

export async function getPlannedWorkoutByIdForUser(id: string, userId: string): Promise<DbPlannedWorkout | undefined> {
	const db = getDb();
	return db
		.select()
		.from(plannedWorkouts)
		.where(and(eq(plannedWorkouts.id, id), eq(plannedWorkouts.userId, userId)))
		.get();
}

export async function listPlannedWorkoutsForUser(input: {
	userId: string;
	fromDate: string; // YYYY-MM-DD inclusive
	toDate: string; // YYYY-MM-DD inclusive
	sport?: Sport;
}): Promise<DbPlannedWorkout[]> {
	const db = getDb();
	const where = [
		eq(plannedWorkouts.userId, input.userId),
		gte(plannedWorkouts.scheduledDate, input.fromDate),
		lte(plannedWorkouts.scheduledDate, input.toDate)
	];
	if (input.sport) {
		where.push(eq(plannedWorkouts.sport, input.sport));
	}
	return db
		.select()
		.from(plannedWorkouts)
		.where(and(...where))
		.orderBy(asc(plannedWorkouts.scheduledDate), asc(plannedWorkouts.title))
		.all();
}

export async function createPlannedWorkout(input: {
	id: string;
	userId: string;
	sport: Sport;
	scheduledDate: string;
	title: string;
	description?: string | null;
	plannedDurationSec?: number | null;
	plannedDistanceM?: number | null;
	plannedLoad?: number | null;
	structureJson?: string | null;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.insert(plannedWorkouts)
		.values({
			id: input.id,
			userId: input.userId,
			sport: input.sport,
			scheduledDate: input.scheduledDate,
			title: input.title,
			description: input.description ?? null,
			plannedDurationSec: input.plannedDurationSec ?? null,
			plannedDistanceM: input.plannedDistanceM ?? null,
			plannedLoad: input.plannedLoad ?? null,
			structureJson: input.structureJson ?? null,
			createdAt: now,
			updatedAt: now
		})
		.run();
}

export async function updatePlannedWorkoutForUser(input: {
	id: string;
	userId: string;
	sport: Sport;
	scheduledDate: string;
	title: string;
	description?: string | null;
	plannedDurationSec?: number | null;
	plannedDistanceM?: number | null;
	plannedLoad?: number | null;
	structureJson?: string | null;
}): Promise<void> {
	const db = getDb();
	db.update(plannedWorkouts)
		.set({
			sport: input.sport,
			scheduledDate: input.scheduledDate,
			title: input.title,
			description: input.description ?? null,
			plannedDurationSec: input.plannedDurationSec ?? null,
			plannedDistanceM: input.plannedDistanceM ?? null,
			plannedLoad: input.plannedLoad ?? null,
			structureJson: input.structureJson ?? null,
			updatedAt: new Date()
		})
		.where(and(eq(plannedWorkouts.id, input.id), eq(plannedWorkouts.userId, input.userId)))
		.run();
}

export async function deletePlannedWorkoutForUser(id: string, userId: string): Promise<void> {
	const db = getDb();
	db.delete(plannedWorkouts)
		.where(and(eq(plannedWorkouts.id, id), eq(plannedWorkouts.userId, userId)))
		.run();
}

