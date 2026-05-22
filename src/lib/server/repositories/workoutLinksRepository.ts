import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { workoutLinks, type WorkoutLinkMatchType } from '$lib/server/db/schema';

export type DbWorkoutLink = typeof workoutLinks.$inferSelect;

export async function getWorkoutLinkForPlannedWorkout(userId: string, plannedWorkoutId: string): Promise<DbWorkoutLink | undefined> {
	const db = getDb();
	return db
		.select()
		.from(workoutLinks)
		.where(and(eq(workoutLinks.userId, userId), eq(workoutLinks.plannedWorkoutId, plannedWorkoutId)))
		.get();
}

export async function listWorkoutLinksForPlannedWorkouts(userId: string, plannedWorkoutIds: string[]): Promise<DbWorkoutLink[]> {
	if (plannedWorkoutIds.length === 0) return [];
	const db = getDb();
	return db
		.select()
		.from(workoutLinks)
		.where(and(eq(workoutLinks.userId, userId), inArray(workoutLinks.plannedWorkoutId, plannedWorkoutIds)))
		.all();
}

export async function listWorkoutLinksForActivities(userId: string, activityIds: string[]): Promise<DbWorkoutLink[]> {
	if (activityIds.length === 0) return [];
	const db = getDb();
	return db
		.select()
		.from(workoutLinks)
		.where(and(eq(workoutLinks.userId, userId), inArray(workoutLinks.activityId, activityIds)))
		.all();
}

export async function getWorkoutLinkForActivity(userId: string, activityId: string): Promise<DbWorkoutLink | undefined> {
	const db = getDb();
	return db
		.select()
		.from(workoutLinks)
		.where(and(eq(workoutLinks.userId, userId), eq(workoutLinks.activityId, activityId)))
		.get();
}

export async function createWorkoutLink(input: {
	id: string;
	userId: string;
	activityId: string;
	plannedWorkoutId: string;
	matchType: WorkoutLinkMatchType;
	durationCompliance?: number | null;
	distanceCompliance?: number | null;
	loadCompliance?: number | null;
}): Promise<void> {
	const db = getDb();
	const now = new Date();
	db.insert(workoutLinks)
		.values({
			id: input.id,
			userId: input.userId,
			activityId: input.activityId,
			plannedWorkoutId: input.plannedWorkoutId,
			matchType: input.matchType,
			durationCompliance: input.durationCompliance ?? null,
			distanceCompliance: input.distanceCompliance ?? null,
			loadCompliance: input.loadCompliance ?? null,
			createdAt: now,
			updatedAt: now
		})
		.run();
}

export async function updateWorkoutLink(input: {
	userId: string;
	plannedWorkoutId: string;
	activityId: string;
	matchType: WorkoutLinkMatchType;
	durationCompliance?: number | null;
	distanceCompliance?: number | null;
	loadCompliance?: number | null;
}): Promise<void> {
	const db = getDb();
	db.update(workoutLinks)
		.set({
			activityId: input.activityId,
			matchType: input.matchType,
			durationCompliance: input.durationCompliance ?? null,
			distanceCompliance: input.distanceCompliance ?? null,
			loadCompliance: input.loadCompliance ?? null,
			updatedAt: new Date()
		})
		.where(and(eq(workoutLinks.userId, input.userId), eq(workoutLinks.plannedWorkoutId, input.plannedWorkoutId)))
		.run();
}

export async function deleteWorkoutLinkForPlannedWorkout(userId: string, plannedWorkoutId: string): Promise<void> {
	const db = getDb();
	db.delete(workoutLinks)
		.where(and(eq(workoutLinks.userId, userId), eq(workoutLinks.plannedWorkoutId, plannedWorkoutId)))
		.run();
}

export async function deleteWorkoutLinksForActivity(userId: string, activityId: string): Promise<void> {
	const db = getDb();
	db.delete(workoutLinks)
		.where(and(eq(workoutLinks.userId, userId), eq(workoutLinks.activityId, activityId)))
		.run();
}
