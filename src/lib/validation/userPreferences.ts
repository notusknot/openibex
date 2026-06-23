import {
	unitsValues,
	weekStartValues,
	type Units,
	type WeekStart
} from '$lib/server/db/schema';

export type UserPreferencesInput = {
	ftpWatts: number | null;
	thresholdHrBpm: number | null;
	maxHrBpm: number | null;
	thresholdPaceSecPerKm: number | null;
	units: Units;
	weekStart: WeekStart;
};

export type UserPreferences = UserPreferencesInput;

function parseIntInRange(
	raw: FormDataEntryValue | null,
	label: string,
	min: number,
	max: number
): { ok: true; value: number | null } | { ok: false; message: string } {
	if (raw === null) return { ok: true, value: null };
	const trimmed = String(raw).trim();
	if (trimmed.length === 0) return { ok: true, value: null };
	const n = Number(trimmed);
	if (!Number.isFinite(n) || !Number.isInteger(n)) {
		return { ok: false, message: `${label} must be a whole number.` };
	}
	if (n < min || n > max) {
		return { ok: false, message: `${label} must be between ${min} and ${max}.` };
	}
	return { ok: true, value: n };
}

// Accepts "m:ss" (e.g. "3:52") or "mm:ss" formats. Returns seconds per km.
function parsePace(
	raw: FormDataEntryValue | null
): { ok: true; value: number | null } | { ok: false; message: string } {
	if (raw === null) return { ok: true, value: null };
	const trimmed = String(raw).trim();
	if (trimmed.length === 0) return { ok: true, value: null };
	const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
	if (!m) return { ok: false, message: 'Threshold pace must be formatted as m:ss (e.g. 3:52).' };
	const minutes = Number(m[1]);
	const seconds = Number(m[2]);
	if (seconds < 0 || seconds > 59) {
		return { ok: false, message: 'Threshold pace seconds must be 00-59.' };
	}
	const total = minutes * 60 + seconds;
	if (total < 120 || total > 720) {
		return {
			ok: false,
			message: 'Threshold pace must be between 2:00 and 12:00 per km.'
		};
	}
	return { ok: true, value: total };
}

function parseEnum<T extends string>(
	raw: FormDataEntryValue | null,
	values: readonly T[],
	label: string
): { ok: true; value: T | null } | { ok: false; message: string } {
	if (raw === null) return { ok: true, value: null };
	const trimmed = String(raw).trim();
	if (trimmed.length === 0) return { ok: true, value: null };
	if ((values as readonly string[]).includes(trimmed)) return { ok: true, value: trimmed as T };
	return { ok: false, message: `${label} must be one of: ${values.join(', ')}.` };
}

// Pace input on the form is in the user's CURRENT display units (sec/km or
// sec/mile). Convert to internal sec/km for storage if the user has imperial.
const KM_PER_MILE = 1.609344;

export function parseUserPreferencesForm(
	form: FormData,
	displayUnits: Units
):
	| { ok: true; value: UserPreferencesInput }
	| { ok: false; message: string } {
	const ftp = parseIntInRange(form.get('ftpWatts'), 'FTP', 100, 600);
	if (!ftp.ok) return ftp;
	const thrHr = parseIntInRange(form.get('thresholdHrBpm'), 'Threshold HR', 100, 220);
	if (!thrHr.ok) return thrHr;
	const maxHr = parseIntInRange(form.get('maxHrBpm'), 'Max HR', 100, 220);
	if (!maxHr.ok) return maxHr;
	const pace = parsePace(form.get('thresholdPace'));
	if (!pace.ok) return pace;
	const units = parseEnum(form.get('units'), unitsValues, 'Units');
	if (!units.ok) return units;
	const weekStart = parseEnum(form.get('weekStart'), weekStartValues, 'Week start');
	if (!weekStart.ok) return weekStart;

	let thresholdPaceSecPerKm = pace.value;
	if (thresholdPaceSecPerKm !== null && displayUnits === 'imperial') {
		// Input was sec/mile; convert to sec/km for storage.
		thresholdPaceSecPerKm = thresholdPaceSecPerKm / KM_PER_MILE;
	}

	return {
		ok: true,
		value: {
			ftpWatts: ftp.value,
			thresholdHrBpm: thrHr.value,
			maxHrBpm: maxHr.value,
			thresholdPaceSecPerKm,
			units: units.value ?? displayUnits,
			weekStart: weekStart.value ?? 'mon'
		}
	};
}
