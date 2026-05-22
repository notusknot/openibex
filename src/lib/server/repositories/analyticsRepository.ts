import { and, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { activities, plannedWorkouts, workoutLinks, type Sport } from '$lib/server/db/schema';

export async function listActivitiesForUserInTimeRangeRepo(input: {
	userId: string;
	from: Date;
	to: Date;
}) {
	const db = getDb();
	return db
		.select()
		.from(activities)
		.where(and(eq(activities.userId, input.userId), gte(activities.startTime, input.from), lte(activities.startTime, input.to)))
		.all();
}

export async function listPlannedWorkoutsForUserInDateRangeRepo(input: {
	userId: string;
	fromDate: string; // YYYY-MM-DD inclusive
	toDate: string; // YYYY-MM-DD inclusive
	sport?: Sport;
}) {
	const db = getDb();
	const where = [
		eq(plannedWorkouts.userId, input.userId),
		gte(plannedWorkouts.scheduledDate, input.fromDate),
		lte(plannedWorkouts.scheduledDate, input.toDate)
	];
	if (input.sport) where.push(eq(plannedWorkouts.sport, input.sport));
	return db
		.select()
		.from(plannedWorkouts)
		.where(and(...where))
		.all();
}

export async function listWorkoutLinksForUserInDateRangeRepo(input: {
	userId: string;
	fromDate: string;
	toDate: string;
	sport?: Sport;
}) {
	const db = getDb();
	const where = [
		eq(workoutLinks.userId, input.userId),
		gte(plannedWorkouts.scheduledDate, input.fromDate),
		lte(plannedWorkouts.scheduledDate, input.toDate)
	];
	if (input.sport) where.push(eq(plannedWorkouts.sport, input.sport));
	// join via planned_workouts scheduled_date range (link is 1:1 with planned workout)
	return db
		.select({
			link: workoutLinks,
			planned: plannedWorkouts,
			activity: activities
		})
		.from(workoutLinks)
		.innerJoin(plannedWorkouts, eq(plannedWorkouts.id, workoutLinks.plannedWorkoutId))
		.innerJoin(activities, eq(activities.id, workoutLinks.activityId))
		.where(and(...where))
		.all();
}
