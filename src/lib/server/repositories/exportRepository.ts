import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';
import { activities, activityFiles, comments, importJobs, plannedWorkouts, users, workoutLinks, appSettings } from '$lib/server/db/schema';

export async function exportUserData(userId: string) {
	const db = getDb();
	const user = db.select().from(users).where(eq(users.id, userId)).get();
	const planned = db.select().from(plannedWorkouts).where(eq(plannedWorkouts.userId, userId)).all();
	const acts = db.select().from(activities).where(eq(activities.userId, userId)).orderBy(desc(activities.startTime)).all();
	const files = db.select().from(activityFiles).where(eq(activityFiles.userId, userId)).orderBy(desc(activityFiles.uploadedAt)).all();
	const jobs = db.select().from(importJobs).where(eq(importJobs.userId, userId)).orderBy(desc(importJobs.createdAt)).all();
	const links = db.select().from(workoutLinks).where(eq(workoutLinks.userId, userId)).all();
	const userComments = db.select().from(comments).where(eq(comments.userId, userId)).orderBy(desc(comments.createdAt)).all();
	const settings = db.select().from(appSettings).all();

	return { user, planned, activities: acts, activityFiles: files, importJobs: jobs, workoutLinks: links, comments: userComments, appSettings: settings };
}

