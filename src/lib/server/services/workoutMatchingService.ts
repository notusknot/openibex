import crypto from 'node:crypto';

import type { Sport } from '$lib/server/db/schema';
import { listPlannedWorkouts } from '$lib/server/services/plannedWorkoutsService';
import { listActivitiesForUserInTimeRange, getActivityByIdForUser } from '$lib/server/repositories/activitiesRepository';
import { listWorkoutLinksForPlannedWorkouts, createWorkoutLink, deleteWorkoutLinkForPlannedWorkout, deleteWorkoutLinksForActivity } from '$lib/server/repositories/workoutLinksRepository';
import { formatLocalDate } from '$lib/validation/localDate';
import { getPlannedWorkoutByIdForUser } from '$lib/server/repositories/plannedWorkoutsRepository';

export type Compliance = {
	duration: number | null;
	distance: number | null;
	load: number | null;
};

function ratio(completed: number | null | undefined, planned: number | null | undefined): number | null {
	if (completed === null || completed === undefined) return null;
	if (planned === null || planned === undefined) return null;
	if (planned <= 0) return null;
	return completed / planned;
}

export function computeCompliance(input: {
	plannedDurationSec: number | null;
	plannedDistanceM: number | null;
	plannedLoad: number | null;
	completedDurationSec: number | null;
	completedDistanceM: number | null;
	completedLoad: number | null;
}): Compliance {
	return {
		duration: ratio(input.completedDurationSec, input.plannedDurationSec),
		distance: ratio(input.completedDistanceM, input.plannedDistanceM),
		load: ratio(input.completedLoad, input.plannedLoad)
	};
}

function activityLocalDate(activity: { startTime: Date }): string {
	return formatLocalDate(new Date(activity.startTime));
}

function localDayStart(date: string): Date {
	// date is YYYY-MM-DD; interpret in server-local time (good enough for v0.1).
	return new Date(`${date}T00:00:00`);
}

function localDayEnd(date: string): Date {
	return new Date(`${date}T23:59:59.999`);
}

export async function ensureAutoMatchesForRange(input: {
	userId: string;
	fromDate: string;
	toDate: string;
	sport?: Sport;
}): Promise<void> {
	const planned = await listPlannedWorkouts({
		userId: input.userId,
		fromDate: input.fromDate,
		toDate: input.toDate,
		sport: input.sport
	});

	const activitiesInRange = await listActivitiesForUserInTimeRange({
		userId: input.userId,
		from: localDayStart(input.fromDate),
		to: localDayEnd(input.toDate)
	});
	const filtered = input.sport ? activitiesInRange.filter((a) => a.sport === input.sport) : activitiesInRange;

	const plannedIds = planned.map((p) => p.id);
	const existingLinks = await listWorkoutLinksForPlannedWorkouts(input.userId, plannedIds);
	const linkedPlanned = new Set(existingLinks.map((l) => l.plannedWorkoutId));
	const linkedActivities = new Set(existingLinks.map((l) => l.activityId));

	// index activities by date+sport
	const byKey = new Map<string, typeof activitiesInRange>();
	for (const a of filtered) {
		const key = `${activityLocalDate(a)}|${a.sport}`;
		const list = byKey.get(key) ?? [];
		list.push(a);
		byKey.set(key, list);
	}
	for (const list of byKey.values()) {
		list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
	}

	for (const p of planned) {
		if (linkedPlanned.has(p.id)) continue;
		const key = `${p.scheduledDate}|${p.sport}`;
		const candidates = byKey.get(key) ?? [];
		const activity = candidates.find((a) => !linkedActivities.has(a.id));
		if (!activity) continue;

		const compliance = computeCompliance({
			plannedDurationSec: p.plannedDurationSec,
			plannedDistanceM: p.plannedDistanceM,
			plannedLoad: p.plannedLoad,
			completedDurationSec: activity.durationSec ?? null,
			completedDistanceM: activity.distanceM ?? null,
			completedLoad: activity.loadScore ?? null
		});

		await createWorkoutLink({
			id: crypto.randomUUID(),
			userId: input.userId,
			activityId: activity.id,
			plannedWorkoutId: p.id,
			matchType: 'auto',
			durationCompliance: compliance.duration,
			distanceCompliance: compliance.distance,
			loadCompliance: compliance.load
		});

		linkedPlanned.add(p.id);
		linkedActivities.add(activity.id);
	}
}

export async function setManualLink(input: { userId: string; plannedWorkoutId: string; activityId: string }): Promise<void> {
	const planned = await getPlannedWorkoutByIdForUser(input.plannedWorkoutId, input.userId);
	if (!planned) throw new Error('Planned workout not found.');
	const activity = await getActivityByIdForUser(input.activityId, input.userId);
	if (!activity) throw new Error('Activity not found.');

	const compliance = computeCompliance({
		plannedDurationSec: planned.plannedDurationSec ?? null,
		plannedDistanceM: planned.plannedDistanceM ?? null,
		plannedLoad: planned.plannedLoad ?? null,
		completedDurationSec: activity.durationSec ?? null,
		completedDistanceM: activity.distanceM ?? null,
		completedLoad: activity.loadScore ?? null
	});

	// enforce 1 planned workout -> 1 link by deleting existing link for that planned workout
	await deleteWorkoutLinkForPlannedWorkout(input.userId, input.plannedWorkoutId);
	// enforce 1 activity -> 1 link (may unlink from another planned workout)
	await deleteWorkoutLinksForActivity(input.userId, input.activityId);

	await createWorkoutLink({
		id: crypto.randomUUID(),
		userId: input.userId,
		activityId: input.activityId,
		plannedWorkoutId: input.plannedWorkoutId,
		matchType: 'manual',
		durationCompliance: compliance.duration,
		distanceCompliance: compliance.distance,
		loadCompliance: compliance.load
	});
}
