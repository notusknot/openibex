// Pure unit-conversion helpers. Internal storage is always SI (meters,
// sec/km, etc.); these convert + format for the user's display preference.

export type Units = 'metric' | 'imperial';

export const KM_PER_MILE = 1.609344;
export const M_PER_FT = 0.3048;

export function distanceFromMeters(meters: number, units: Units): number {
	const km = meters / 1000;
	return units === 'imperial' ? km / KM_PER_MILE : km;
}

export function distanceLabel(
	meters: number | null | undefined,
	units: Units,
	decimals = 1
): string {
	if (meters === null || meters === undefined || !Number.isFinite(meters) || meters <= 0) {
		return '—';
	}
	return distanceFromMeters(meters, units).toFixed(decimals);
}

export function distanceUnit(units: Units): string {
	return units === 'imperial' ? 'mi' : 'km';
}

export function elevationLabel(
	meters: number | null | undefined,
	units: Units
): string {
	if (meters === null || meters === undefined || !Number.isFinite(meters)) return '—';
	const v = units === 'imperial' ? meters / M_PER_FT : meters;
	return String(Math.round(v));
}

export function elevationUnit(units: Units): string {
	return units === 'imperial' ? 'ft' : 'm';
}

// Convert an internal sec/km pace to the user's display unit (sec/km or
// sec/mile). Pace per mile is larger because miles are longer.
export function paceFromSecPerKm(secPerKm: number, units: Units): number {
	return units === 'imperial' ? secPerKm * KM_PER_MILE : secPerKm;
}

export function paceLabel(
	secPerKm: number | null | undefined,
	units: Units
): string {
	if (
		secPerKm === null ||
		secPerKm === undefined ||
		!Number.isFinite(secPerKm) ||
		secPerKm <= 0
	) {
		return '—';
	}
	const sec = paceFromSecPerKm(secPerKm, units);
	const m = Math.floor(sec / 60);
	const s = Math.round(sec % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

export function paceUnit(units: Units): string {
	return units === 'imperial' ? '/mi' : '/km';
}

// Convenience: distance + unit in one string, e.g. "13.4 km" / "8.3 mi".
export function distanceWithUnit(
	meters: number | null | undefined,
	units: Units,
	decimals = 1
): string {
	if (meters === null || meters === undefined || !Number.isFinite(meters) || meters <= 0) {
		return '—';
	}
	return `${distanceLabel(meters, units, decimals)} ${distanceUnit(units)}`;
}
