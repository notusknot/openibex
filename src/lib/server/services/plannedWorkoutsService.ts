import crypto from 'node:crypto';

import type { Sport } from '$lib/server/db/schema';
import type { DbPlannedWorkout } from '$lib/server/repositories/plannedWorkoutsRepository';
import {
	createPlannedWorkout,
	deletePlannedWorkoutForUser,
	getPlannedWorkoutByIdForUser,
	listPlannedWorkoutsForUser,
	updatePlannedWorkoutForUser
} from '$lib/server/repositories/plannedWorkoutsRepository';

export type PlannedWorkout = {
	id: string;
	userId: string;
	sport: Sport;
	scheduledDate: string;
	title: string;
	description: string | null;
	plannedDurationSec: number | null;
	plannedDistanceM: number | null;
	plannedLoad: number | null;
	createdAt: Date;
	updatedAt: Date;
};

function toPlannedWorkout(row: DbPlannedWorkout): PlannedWorkout {
	return {
		id: row.id,
		userId: row.userId,
		sport: row.sport,
		scheduledDate: row.scheduledDate,
		title: row.title,
		description: row.description ?? null,
		plannedDurationSec: row.plannedDurationSec ?? null,
		plannedDistanceM: row.plannedDistanceM ?? null,
		plannedLoad: row.plannedLoad ?? null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export async function listPlannedWorkouts(input: {
	userId: string;
	fromDate: string;
	toDate: string;
	sport?: Sport;
}): Promise<PlannedWorkout[]> {
	const rows = await listPlannedWorkoutsForUser(input);
	return rows.map(toPlannedWorkout);
}

export async function getPlannedWorkoutForEdit(input: {
	userId: string;
	id: string;
}): Promise<PlannedWorkout | null> {
	const row = await getPlannedWorkoutByIdForUser(input.id, input.userId);
	return row ? toPlannedWorkout(row) : null;
}

export async function createPlannedWorkoutForUser(input: {
	userId: string;
	sport: Sport;
	scheduledDate: string;
	title: string;
	description: string | null;
	plannedDurationSec: number | null;
	plannedDistanceM: number | null;
	plannedLoad: number | null;
}): Promise<{ id: string }> {
	const id = crypto.randomUUID();
	await createPlannedWorkout({
		id,
		userId: input.userId,
		sport: input.sport,
		scheduledDate: input.scheduledDate,
		title: input.title,
		description: input.description,
		plannedDurationSec: input.plannedDurationSec,
		plannedDistanceM: input.plannedDistanceM,
		plannedLoad: input.plannedLoad
	});
	return { id };
}

export async function updatePlannedWorkoutForUserService(input: {
	userId: string;
	id: string;
	sport: Sport;
	scheduledDate: string;
	title: string;
	description: string | null;
	plannedDurationSec: number | null;
	plannedDistanceM: number | null;
	plannedLoad: number | null;
}): Promise<void> {
	const existing = await getPlannedWorkoutByIdForUser(input.id, input.userId);
	if (!existing) {
		throw new Error('Not found.');
	}
	await updatePlannedWorkoutForUser({
		id: input.id,
		userId: input.userId,
		sport: input.sport,
		scheduledDate: input.scheduledDate,
		title: input.title,
		description: input.description,
		plannedDurationSec: input.plannedDurationSec,
		plannedDistanceM: input.plannedDistanceM,
		plannedLoad: input.plannedLoad
	});
}

export async function deletePlannedWorkoutForUserService(input: {
	userId: string;
	id: string;
}): Promise<void> {
	const existing = await getPlannedWorkoutByIdForUser(input.id, input.userId);
	if (!existing) {
		throw new Error('Not found.');
	}
	await deletePlannedWorkoutForUser(input.id, input.userId);
}

