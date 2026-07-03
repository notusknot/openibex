// Pure SVG coordinate math for the dashboard charts — series in, coordinates
// out. No DOM, no Svelte state: unit-testable in isolation (chartGeometry.test.ts).

// PMC chart sizing — matches the prototype viewBox.
export const PMC_W = 600;
export const PMC_PAD_L = 6;
export const PMC_PAD_T = 6;
export const PMC_INNER_H = 158;
export const PMC_INNER_W = PMC_W - 2 * PMC_PAD_L; // 588
export const PMC_VIEW_H = 184;

// Weekly stacked bars sizing.
export const BAR_W = 564;
export const BAR_PAD_L = 4;
export const BAR_PAD_T = 6;
export const BAR_INNER_H = 116;
export const BAR_BASE_Y = BAR_PAD_T + BAR_INNER_H; // 122
export const BAR_VIEW_H = 134;
export const BAR_CAP_W = 26;

export type PmcPoint = { dateMs: number; ctl: number; atl: number; tsb: number };
export type WeekVolume = { label: string; total: number; swim: number; bike: number; run: number };

export function computePmcGeo(vals: PmcPoint[]) {
	const n = Math.max(1, vals.length);
	let mn = Infinity;
	let mx = -Infinity;
	for (const v of vals) {
		for (const z of [v.ctl, v.atl, v.tsb]) {
			if (z < mn) mn = z;
			if (z > mx) mx = z;
		}
	}
	if (!Number.isFinite(mn) || !Number.isFinite(mx) || mn === mx) {
		mn = -2;
		mx = 2;
	}
	mn = Math.floor(mn) - 2;
	mx = Math.ceil(mx) + 2;
	const X = (i: number) => PMC_PAD_L + (n === 1 ? 0 : (i / (n - 1)) * PMC_INNER_W);
	const Y = (v: number) => PMC_PAD_T + ((mx - v) / (mx - mn)) * PMC_INNER_H;
	const pts = (key: 'ctl' | 'atl' | 'tsb') =>
		vals.map((v, i) => `${X(i).toFixed(1)},${Y(v[key]).toFixed(1)}`).join(' ');
	const grid: { y: string; label: number }[] = [];
	for (let k = 0; k <= 4; k++) {
		const val = mn + ((mx - mn) * k) / 4;
		grid.push({ y: Y(val).toFixed(1), label: Math.round(val) });
	}
	const xLabels: { x: string; label: string }[] = [];
	for (let k = 0; k < 5 && n > 1; k++) {
		const i = Math.round((k / 4) * (n - 1));
		const v = vals[i];
		if (!v) continue;
		const dt = new Date(v.dateMs);
		xLabels.push({ x: X(i).toFixed(1), label: `${dt.getMonth() + 1}/${dt.getDate()}` });
	}
	const zeroY = Y(0).toFixed(1);
	const formArea = `${PMC_PAD_L},${zeroY} ${pts('tsb')} ${X(n - 1).toFixed(1)},${zeroY}`;
	return {
		n,
		vals,
		X,
		Y,
		fitnessPts: pts('ctl'),
		fatiguePts: pts('atl'),
		formPts: pts('tsb'),
		formArea,
		zeroY,
		gridLines: grid,
		xLabels
	};
}

export function computeBarGeo(weeks: WeekVolume[]) {
	const innerW = BAR_W - 2 * BAR_PAD_L;
	const slot = innerW / Math.max(1, weeks.length);
	const barW = Math.min(BAR_CAP_W, slot - (BAR_CAP_W < 18 ? 5 : 11));
	const maxTotal = weeks.reduce((m, w) => Math.max(m, w.total), 0) || 1;
	return weeks.map((w, i) => {
		const h = (w.total / maxTotal) * BAR_INNER_H;
		const runH = w.total ? (w.run / w.total) * h : 0;
		const bikeH = w.total ? (w.bike / w.total) * h : 0;
		const swimH = w.total ? (w.swim / w.total) * h : 0;
		const x = BAR_PAD_L + slot * i + (slot - barW) / 2;
		const runY = BAR_BASE_Y - runH;
		const bikeY = runY - bikeH;
		const swimY = bikeY - swimH;
		return {
			i,
			x: +x.toFixed(1),
			cx: +(x + barW / 2).toFixed(1),
			barW: +barW.toFixed(1),
			label: w.label,
			total: w.total,
			swim: w.swim,
			bike: w.bike,
			run: w.run,
			runY: +runY.toFixed(1),
			runH: +runH.toFixed(1),
			bikeY: +bikeY.toFixed(1),
			bikeH: +bikeH.toFixed(1),
			swimY: +swimY.toFixed(1),
			swimH: +swimH.toFixed(1)
		};
	});
}
