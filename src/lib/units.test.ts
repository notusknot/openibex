import { describe, expect, it } from 'vitest';

import {
	distanceFromMeters,
	distanceLabel,
	distanceUnit,
	elevationLabel,
	elevationUnit,
	paceFromSecPerKm,
	paceLabel,
	paceUnit
} from '$lib/units';

describe('units', () => {
	it('distance converts to km/mi correctly', () => {
		// 10 000 m = 10 km = 6.21371 mi
		expect(distanceFromMeters(10000, 'metric')).toBeCloseTo(10, 4);
		expect(distanceFromMeters(10000, 'imperial')).toBeCloseTo(6.21371, 4);
	});

	it('distanceLabel handles missing/zero/non-finite gracefully', () => {
		expect(distanceLabel(null, 'metric')).toBe('—');
		expect(distanceLabel(undefined, 'metric')).toBe('—');
		expect(distanceLabel(0, 'metric')).toBe('—');
		expect(distanceLabel(NaN, 'metric')).toBe('—');
		expect(distanceLabel(13400, 'metric')).toBe('13.4');
		expect(distanceLabel(13400, 'imperial')).toBe('8.3');
	});

	it('distanceUnit returns mi/km', () => {
		expect(distanceUnit('metric')).toBe('km');
		expect(distanceUnit('imperial')).toBe('mi');
	});

	it('elevation converts m/ft', () => {
		// 1000m ≈ 3280 ft
		expect(elevationLabel(1000, 'metric')).toBe('1000');
		expect(elevationLabel(1000, 'imperial')).toBe('3281');
		expect(elevationUnit('metric')).toBe('m');
		expect(elevationUnit('imperial')).toBe('ft');
	});

	it('pace converts sec/km ↔ sec/mile', () => {
		// 4:00/km = 4 * 1.609344 = 6:26 (≈386s)/mile
		expect(paceFromSecPerKm(240, 'metric')).toBe(240);
		expect(paceFromSecPerKm(240, 'imperial')).toBeCloseTo(386.24, 1);
	});

	it('paceLabel formats m:ss for both units', () => {
		expect(paceLabel(240, 'metric')).toBe('4:00');
		expect(paceLabel(240, 'imperial')).toBe('6:26');
		expect(paceLabel(null, 'metric')).toBe('—');
		expect(paceLabel(0, 'metric')).toBe('—');
		expect(paceUnit('imperial')).toBe('/mi');
		expect(paceUnit('metric')).toBe('/km');
	});
});
