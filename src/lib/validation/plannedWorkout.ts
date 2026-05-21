import { sports, type Sport } from '$lib/server/db/schema';
import { isLocalDate } from '$lib/validation/localDate';

export type PlannedWorkoutInput = {
	sport: Sport;
	scheduledDate: string;
	title: string;
	description: string | null;
	plannedDurationSec: number | null;
	plannedDistanceM: number | null;
	plannedLoad: number | null;
};

export function parseSport(value: string): Sport | null {
	return (sports as readonly string[]).includes(value) ? (value as Sport) : null;
}

function parseNullableNumber(value: FormDataEntryValue | null): number | null | undefined {
	if (value === null) return null;
	const raw = String(value).trim();
	if (raw.length === 0) return null;
	const num = Number(raw);
	if (!Number.isFinite(num)) return undefined;
	return num;
}

export function parsePlannedWorkoutForm(form: FormData):
	| { ok: true; value: PlannedWorkoutInput }
	| { ok: false; message: string } {
	const sportRaw = String(form.get('sport') ?? '');
	const sport = parseSport(sportRaw);
	if (!sport) return { ok: false, message: 'Invalid sport.' };

	const scheduledDate = String(form.get('scheduledDate') ?? '').trim();
	if (!isLocalDate(scheduledDate)) return { ok: false, message: 'Invalid scheduled date.' };

	const title = String(form.get('title') ?? '').trim();
	if (title.length === 0) return { ok: false, message: 'Title is required.' };
	if (title.length > 120) return { ok: false, message: 'Title must be 120 characters or less.' };

	const descriptionRaw = String(form.get('description') ?? '').trim();
	const description = descriptionRaw.length > 0 ? descriptionRaw : null;

	const plannedDurationSecRaw = parseNullableNumber(form.get('plannedDurationSec'));
	if (plannedDurationSecRaw === undefined) return { ok: false, message: 'Invalid planned duration.' };
	const plannedDurationSec = plannedDurationSecRaw ?? null;
	if (plannedDurationSec !== null && plannedDurationSec < 0) return { ok: false, message: 'Duration must be positive.' };

	const plannedDistanceMRaw = parseNullableNumber(form.get('plannedDistanceM'));
	if (plannedDistanceMRaw === undefined) return { ok: false, message: 'Invalid planned distance.' };
	const plannedDistanceM = plannedDistanceMRaw ?? null;
	if (plannedDistanceM !== null && plannedDistanceM < 0) return { ok: false, message: 'Distance must be positive.' };

	const plannedLoadRaw = parseNullableNumber(form.get('plannedLoad'));
	if (plannedLoadRaw === undefined) return { ok: false, message: 'Invalid planned load.' };
	const plannedLoad = plannedLoadRaw ?? null;
	if (plannedLoad !== null && plannedLoad < 0) return { ok: false, message: 'Load must be positive.' };

	return {
		ok: true,
		value: {
			sport,
			scheduledDate,
			title,
			description,
			plannedDurationSec,
			plannedDistanceM,
			plannedLoad
		}
	};
}
