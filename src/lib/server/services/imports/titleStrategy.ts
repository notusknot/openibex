import type { Sport } from '$lib/server/db/schema';
import {
	resolveNameByFingerprint,
	type GarminMetadataLookup
} from '$lib/server/services/imports/garminMetadata';

const HOUR_LABELS: { label: string; startHour: number }[] = [
	{ label: 'Night', startHour: 0 },
	{ label: 'Morning', startHour: 5 },
	{ label: 'Afternoon', startHour: 12 },
	{ label: 'Evening', startHour: 17 },
	{ label: 'Night', startHour: 21 }
];

// Sport phrasing for human-readable titles. "Other"/"Strength" become "Workout"
// because "Morning Other" reads as noise; everything else keeps its name.
const SPORT_LABEL: Record<Sport, string> = {
	Run: 'Run',
	Bike: 'Bike',
	Swim: 'Swim',
	Strength: 'Workout',
	Other: 'Workout'
};

function timeOfDayFor(date: Date): string {
	const hour = date.getHours();
	let label = HOUR_LABELS[0]!.label;
	for (const slot of HOUR_LABELS) {
		if (hour >= slot.startHour) label = slot.label;
		else break;
	}
	return label;
}

export function composeSmartTitle(input: {
	metadataLookup: GarminMetadataLookup | null;
	sport: Sport;
	startTime: Date;
}): string {
	if (input.metadataLookup) {
		const metaName = resolveNameByFingerprint(input.metadataLookup, {
			sport: input.sport,
			startTime: input.startTime
		});
		if (metaName) return metaName;
	}
	return `${timeOfDayFor(input.startTime)} ${SPORT_LABEL[input.sport]}`;
}
