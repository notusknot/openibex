import { describe, expect, it } from 'vitest';

import {
	fallbackLoadScore,
	intensityFactorFor,
	loadFor
} from '$lib/server/services/analytics/load';

describe('intensityFactorFor', () => {
	it('uses user FTP for bike power', () => {
		// avgPower 250 / FTP 250 = 1.0
		expect(
			intensityFactorFor({ sport: 'Bike', avgPowerW: 250 }, { ftpWatts: 250, thresholdHrBpm: null })
		).toBeCloseTo(1.0, 4);
		// avgPower 250 / default FTP 240 ≈ 1.0417 when no user FTP set
		expect(intensityFactorFor({ sport: 'Bike', avgPowerW: 250 }, null)).toBeCloseTo(1.0417, 3);
	});

	it('prefers normalized over avg power when present', () => {
		expect(
			intensityFactorFor(
				{ sport: 'Bike', avgPowerW: 200, normalizedPowerLikeW: 240 },
				{ ftpWatts: 240, thresholdHrBpm: null }
			)
		).toBeCloseTo(1.0, 4);
	});

	it('uses user threshold HR for run', () => {
		expect(
			intensityFactorFor({ sport: 'Run', avgHr: 170 }, { ftpWatts: null, thresholdHrBpm: 170 })
		).toBeCloseTo(1.0, 4);
		// fallback to default 160
		expect(intensityFactorFor({ sport: 'Run', avgHr: 160 }, null)).toBeCloseTo(1.0, 4);
	});

	it('returns null for sports without HR/power signal', () => {
		expect(intensityFactorFor({ sport: 'Swim' }, null)).toBeNull();
		expect(intensityFactorFor({ sport: 'Run', avgHr: null }, null)).toBeNull();
	});
});

describe('loadFor', () => {
	it('prefers stored loadScore when present', () => {
		expect(
			loadFor({ sport: 'Run', durationSec: 3600, loadScore: 88 }, null)
		).toBe(88);
	});

	it('computes IF-based TSS when threshold + signal are available', () => {
		// 1h at IF 1.0 (250W vs 250 FTP) = 100 TSS
		expect(
			loadFor(
				{ sport: 'Bike', durationSec: 3600, avgPowerW: 250, loadScore: null },
				{ ftpWatts: 250, thresholdHrBpm: null }
			)
		).toBeCloseTo(100, 0);
		// 0.5h at IF 0.8 (200W vs 250) = 0.5 * 0.64 * 100 = 32 TSS
		expect(
			loadFor(
				{ sport: 'Bike', durationSec: 1800, avgPowerW: 200, loadScore: null },
				{ ftpWatts: 250, thresholdHrBpm: null }
			)
		).toBeCloseTo(32, 0);
	});

	it('falls back to sport-factor TSS when no signal available', () => {
		// Swim 1h with no power/HR → sport factor 0.65 → 65 TSS
		const swim = loadFor({ sport: 'Swim', durationSec: 3600, loadScore: null }, null);
		expect(swim).toBeCloseTo(65, 0);
	});

	it('matches fallbackLoadScore for sport-factor case', () => {
		const a = { sport: 'Bike' as const, durationSec: 3600, loadScore: null };
		expect(loadFor(a, null)).toBeCloseTo(fallbackLoadScore(a)!, 0);
	});
});
