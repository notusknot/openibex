import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { createActivity } from '$lib/server/repositories/activitiesRepository';
import {
	buildKpiIndicators,
	getDashboardData,
	trackPct
} from '$lib/server/services/dashboardService';

function setTestEnv(dataDir: string) {
	process.env.OPENIBEX_ENV = 'test';
	process.env.NODE_ENV = 'test';
	process.env.OPEN_REGISTRATION = 'true';
	process.env.SESSION_SECRET = 'test-secret-test-secret';
	process.env.SESSION_TTL_DAYS = '1';
	process.env.OPENIBEX_DATA_DIR = dataDir;
	process.env.OPENIBEX_UPLOAD_DIR = path.join(dataDir, 'uploads');
	process.env.OPENIBEX_STREAM_DIR = path.join(dataDir, 'streams');
	process.env.OPENIBEX_EXPORT_DIR = path.join(dataDir, 'exports');
	process.env.OPENIBEX_IMPORT_DIR = path.join(dataDir, 'imports');
	process.env.DATABASE_URL = `file:${path.join(dataDir, 'openibex.db')}`;
}

describe('trackPct', () => {
	it('maps a value onto a 0–100 track and clamps the ends', () => {
		expect(trackPct(0, 0, 100)).toBe(0);
		expect(trackPct(50, 0, 100)).toBe(50);
		expect(trackPct(100, 0, 100)).toBe(100);
		expect(trackPct(-10, 0, 100)).toBe(0); // clamped low
		expect(trackPct(200, 0, 100)).toBe(100); // clamped high
		expect(trackPct(-10, -30, 30)).toBeCloseTo(33.33, 1); // offset range
	});

	it('returns 0 for a degenerate range (max <= min)', () => {
		expect(trackPct(5, 10, 10)).toBe(0);
	});
});

describe('buildKpiIndicators band logic', () => {
	const base = {
		ctl: 50,
		atl: 50,
		tsb: 0,
		weekTss: 350,
		rampN: 0,
		readinessVal: 50,
		readinessLabel: 'Productive',
		monotonyN: 1.0,
		hasData: true
	};
	const ind = (over: Partial<typeof base>) => buildKpiIndicators({ ...base, ...over });

	it('returns all-neutral when there is no data', () => {
		const r = buildKpiIndicators({ ...base, hasData: false });
		for (const k of ['fitness', 'fatigue', 'form', 'weekTss', 'readiness', 'monotony'] as const) {
			expect(r[k].status).toBe('—');
			expect(r[k].tone).toBe('neutral');
		}
	});

	it('fitness status follows the ramp rate', () => {
		expect(ind({ rampN: 10 }).fitness).toMatchObject({ status: 'Spiking', tone: 'warn' });
		expect(ind({ rampN: 5 }).fitness).toMatchObject({ status: 'Building', tone: 'good' });
		expect(ind({ rampN: 0 }).fitness).toMatchObject({ status: 'Steady', tone: 'good' });
		expect(ind({ rampN: -4 }).fitness).toMatchObject({ status: 'Easing', tone: 'easy' });
		expect(ind({ rampN: -8 }).fitness).toMatchObject({ status: 'Detraining', tone: 'warn' });
	});

	it('fatigue status follows the ATL/CTL ratio', () => {
		expect(ind({ ctl: 50, atl: 30 }).fatigue).toMatchObject({ status: 'Low', tone: 'good' }); // 0.6
		expect(ind({ ctl: 50, atl: 50 }).fatigue).toMatchObject({ status: 'Normal', tone: 'good' }); // 1.0
		expect(ind({ ctl: 50, atl: 65 }).fatigue).toMatchObject({ status: 'High', tone: 'warn' }); // 1.3
		expect(ind({ ctl: 50, atl: 80 }).fatigue).toMatchObject({ status: 'Very high', tone: 'bad' }); // 1.6
	});

	it('form status follows TSB bands', () => {
		expect(ind({ tsb: 25 }).form).toMatchObject({ status: 'Peaked', tone: 'easy' });
		expect(ind({ tsb: 10 }).form).toMatchObject({ status: 'Fresh', tone: 'good' });
		expect(ind({ tsb: 0 }).form).toMatchObject({ status: 'Balanced', tone: 'good' });
		expect(ind({ tsb: -15 }).form).toMatchObject({ status: 'Fatigued', tone: 'warn' });
		expect(ind({ tsb: -30 }).form).toMatchObject({ status: 'Overreached', tone: 'bad' });
	});

	it('week-TSS status follows load relative to a sustainable week', () => {
		// sustainable = max(ctl,1) * 7 = 350.
		expect(ind({ weekTss: 100 }).weekTss).toMatchObject({ status: 'Easing', tone: 'easy' }); // 0.29
		expect(ind({ weekTss: 350 }).weekTss).toMatchObject({ status: 'On track', tone: 'good' }); // 1.0
		expect(ind({ weekTss: 490 }).weekTss).toMatchObject({ status: 'Loading', tone: 'warn' }); // 1.4
		expect(ind({ weekTss: 700 }).weekTss).toMatchObject({ status: 'Overload', tone: 'bad' }); // 2.0
	});

	it('readiness uses the supplied label and a value-based tone', () => {
		expect(ind({ readinessVal: 80, readinessLabel: 'Race-ready' }).readiness).toMatchObject({
			status: 'Race-ready',
			tone: 'good'
		});
		expect(ind({ readinessVal: 30 }).readiness.tone).toBe('warn');
		expect(ind({ readinessVal: 20 }).readiness.tone).toBe('bad');
	});

	it('monotony bands, and neutral when not finite', () => {
		expect(ind({ monotonyN: 1.0 }).monotony).toMatchObject({ status: 'Varied', tone: 'good' });
		expect(ind({ monotonyN: 1.7 }).monotony).toMatchObject({ status: 'Moderate', tone: 'warn' });
		expect(ind({ monotonyN: 2.2 }).monotony).toMatchObject({ status: 'Monotonous', tone: 'bad' });
		expect(ind({ monotonyN: Infinity }).monotony).toMatchObject({ status: '—', tone: 'neutral' });
	});
});

describe('getDashboardData EWMA pipeline', () => {
	let userId: string;

	beforeEach(async () => {
		const dataDir = `/tmp/openibex-dash-${Date.now()}-${Math.random().toString(16).slice(2)}`;
		fs.mkdirSync(dataDir, { recursive: true });
		setTestEnv(dataDir);
		resetDbForTests();
		const { user } = await registerWithEmailPassword({ email: 'a@example.com', password: 'password123' });
		userId = user.id;
	});

	const NOW = new Date('2026-06-15T12:00:00');

	it('reports no data for a user with no activities', async () => {
		const d = await getDashboardData(userId, { now: NOW, prefs: null });
		expect(d.hasData).toBe(false);
		expect(d.kpis.fitness).toBe(0);
		expect(d.kpis.fatigue).toBe(0);
		expect(d.kpis.weekTss).toBe(0);
		expect(d.indicators.fitness.status).toBe('—');
	});

	it('computes EWMA fitness/fatigue/form for a single 60-load day', async () => {
		// One activity of load 60 on "today" (the last day of the 84-day window).
		// EWMA seeds at 0, so on the final day:
		//   ctl = 60 * (1 - e^-1/42) ≈ 1.41  -> round 1
		//   atl = 60 * (1 - e^-1/7)  ≈ 7.99  -> round 8
		//   tsb = ctl - atl          ≈ -6.58 -> round -7
		//   readiness = round(50 + tsb*1.6) = round(39.48) = 39 -> 'Fatigued'
		await createActivity({
			id: 'act1',
			userId,
			activityFileId: null,
			sport: 'Run',
			title: 'Today run',
			startTime: new Date('2026-06-15T08:00:00'),
			loadScore: 60
		});

		const d = await getDashboardData(userId, { now: NOW, prefs: null });
		expect(d.hasData).toBe(true);
		expect(d.kpis.fitness).toBe(1);
		expect(d.kpis.fatigue).toBe(8);
		expect(d.kpis.formNum).toBe(-7);
		expect(d.kpis.weekTss).toBe(60);
		expect(d.kpis.readinessVal).toBe(39);
		expect(d.kpis.readinessLabel).toBe('Fatigued');
		// Last point of the series matches the KPIs (rounded).
		const last = d.series[d.series.length - 1]!;
		expect(Math.round(last.ctl)).toBe(1);
		expect(Math.round(last.atl)).toBe(8);
	});
});
