<script lang="ts">
	import type { PageData } from './$types';
	import { theme, setTheme, type Theme } from '$lib/stores/theme';

	export let data: PageData;
	$: dashboard = data.dashboard;

	type Range = '4w' | '8w' | '12w';
	let range: Range = '12w';
	let pmcHoverIdx: number | null = null;
	let barHoverIdx: number | null = null;

	const RANGES: { key: Range; label: string }[] = [
		{ key: '4w', label: '4W' },
		{ key: '8w', label: '8W' },
		{ key: '12w', label: '12W' }
	];

	// PMC chart sizing — matches the prototype viewBox.
	const PMC_W = 600;
	const PMC_PAD_L = 6;
	const PMC_PAD_T = 6;
	const PMC_INNER_H = 158;
	const PMC_INNER_W = PMC_W - 2 * PMC_PAD_L; // 588
	const PMC_VIEW_H = 184;

	// Weekly stacked bars sizing.
	const BAR_W = 564;
	const BAR_PAD_L = 4;
	const BAR_PAD_T = 6;
	const BAR_INNER_H = 116;
	const BAR_BASE_Y = BAR_PAD_T + BAR_INNER_H; // 122
	const BAR_VIEW_H = 134;
	const BAR_CAP_W = 26;

	// Sport-split donut.
	const DONUT_R = 46;
	const DONUT_C = 2 * Math.PI * DONUT_R;

	// Readiness ring.
	const READ_R = 52;
	const READ_C = 2 * Math.PI * READ_R;

	$: pmcVisible = (() => {
		const n = range === '4w' ? 28 : range === '8w' ? 56 : 84;
		return dashboard.series.slice(-Math.min(n, dashboard.series.length));
	})();
	$: pmcGeo = computePmcGeo(pmcVisible);
	$: pmcHover = (() => {
		const idx = pmcHoverIdx;
		if (idx === null) return null;
		const v = pmcGeo.vals[idx];
		if (!v) return null;
		const lp = pmcGeo.X(idx);
		const dt = new Date(v.dateMs);
		return {
			leftPct: `${((lp / PMC_W) * 100).toFixed(2)}%`,
			fitY: pmcGeo.Y(v.ctl),
			fatY: pmcGeo.Y(v.atl),
			formY: pmcGeo.Y(v.tsb),
			x: lp,
			fit: Math.round(v.ctl),
			fat: Math.round(v.atl),
			form: (v.tsb >= 0 ? '+' : '') + Math.round(v.tsb),
			date: `${dt.getMonth() + 1}/${dt.getDate()}`
		};
	})();

	$: bars = computeBarGeo(dashboard.weeks);
	$: barHover = (() => {
		const idx = barHoverIdx;
		if (idx === null) return null;
		const b = bars[idx];
		if (!b) return null;
		return {
			leftPct: `${((b.cx / BAR_W) * 100).toFixed(2)}%`,
			label: b.label,
			total: b.total,
			swim: b.swim,
			bike: b.bike,
			run: b.run
		};
	})();

	$: donut = (() => {
		const swim = dashboard.sport.swimPct / 100;
		const bike = dashboard.sport.bikePct / 100;
		const run = dashboard.sport.runPct / 100;
		let cum = 0;
		const seg = (frac: number) => {
			const len = frac * DONUT_C;
			const out = {
				dash: `${len.toFixed(1)} ${(DONUT_C - len).toFixed(1)}`,
				offset: (-cum * DONUT_C).toFixed(1)
			};
			cum += frac;
			return out;
		};
		return { swim: seg(swim), bike: seg(bike), run: seg(run) };
	})();

	$: readinessDash = `${((READ_C * dashboard.kpis.readinessVal) / 100).toFixed(1)} ${READ_C.toFixed(1)}`;

	// Plain-language explanations for the calculated training-load metrics,
	// surfaced as native browser tooltips (title attributes): what the number is
	// and how it should steer planning. Shared because Readiness and Monotony
	// each appear in two places on this page.
	const STAT_TIPS = {
		fitness:
			'Fitness (CTL): your 42-day exponentially-weighted average daily training load. Represents accumulated fitness — it climbs slowly with consistent training. Build it gradually; sharp jumps raise injury and overtraining risk.',
		fatigue:
			'Fatigue (ATL): your 7-day exponentially-weighted average daily load — short-term tiredness. When it stays high, schedule recovery before piling on more hard work.',
		form:
			'Form (TSB) = Fitness − Fatigue. Positive means fresh and rested; negative means you are carrying fatigue (normal during a build block). Aim for positive (roughly +5 to +20) going into key races.',
		weekTss:
			'Week TSS: total Training Stress Score over the last 7 days — your weekly training load. Keep week-to-week changes gradual rather than spiking it.',
		readiness:
			'Readiness: a 0–100 score derived from your Form/TSB (higher = fresher). Low → favour recovery or easy sessions; high → you can absorb intensity or race.',
		monotony:
			'Monotony: average daily load ÷ its 7-day standard deviation. High values (above ~2) mean every day looks the same — vary hard and easy days to bring it down.',
		strain:
			'Strain: weekly load × monotony. High strain is associated with illness, injury, and overtraining. Watch for sharp spikes.'
	};

	$: kpiCards = [
		{ label: 'Fitness', val: String(dashboard.kpis.fitness), sub: `CTL · ramp ${dashboard.kpis.ramp}`, accent: 'var(--c-fit)', tip: STAT_TIPS.fitness, ind: dashboard.indicators.fitness },
		{ label: 'Fatigue', val: String(dashboard.kpis.fatigue), sub: 'ATL · 7-day', accent: 'var(--c-fat)', tip: STAT_TIPS.fatigue, ind: dashboard.indicators.fatigue },
		{ label: 'Form', val: dashboard.kpis.form, sub: `TSB · ${dashboard.kpis.readinessLabel}`, accent: 'var(--c-form)', tip: STAT_TIPS.form, ind: dashboard.indicators.form },
		{ label: 'Week TSS', val: String(dashboard.kpis.weekTss), sub: 'swim/bike/run', accent: 'var(--swim)', tip: STAT_TIPS.weekTss, ind: dashboard.indicators.weekTss },
		{ label: 'Readiness', val: String(dashboard.kpis.readinessVal), sub: dashboard.kpis.readinessLabel, accent: 'var(--green)', tip: STAT_TIPS.readiness, ind: dashboard.indicators.readiness },
		{ label: 'Monotony', val: dashboard.kpis.monotony, sub: `strain ${dashboard.kpis.strain}`, accent: 'var(--bike)', tip: STAT_TIPS.monotony, ind: dashboard.indicators.monotony }
	];

	function computePmcGeo(vals: PageData['dashboard']['series']) {
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

	function computeBarGeo(weeks: PageData['dashboard']['weeks']) {
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

	function onPmcMove(e: MouseEvent) {
		const target = e.currentTarget as SVGGraphicsElement;
		const css = target.getBoundingClientRect().width || 1;
		const userX = (e.offsetX / css) * PMC_W;
		const chartX = userX - PMC_PAD_L;
		const frac = Math.max(0, Math.min(1, chartX / PMC_INNER_W));
		const i = Math.round(frac * Math.max(0, pmcGeo.n - 1));
		if (pmcHoverIdx !== i) pmcHoverIdx = i;
	}

	function onBarMove(e: MouseEvent) {
		let el = e.target as HTMLElement | null;
		while (el && (!el.dataset || el.dataset['bi'] == null)) el = el.parentElement;
		if (!el) return;
		const i = Number(el.dataset['bi']);
		if (!Number.isFinite(i)) return;
		if (barHoverIdx !== i) barHoverIdx = i;
	}

	function pickTheme(next: Theme) {
		setTheme(next);
	}
</script>

<section class="dash">
	<header class="head">
		<div>
			<h1 class="title">Dashboard</h1>
			<p class="subtitle oi-mono">Last 12 weeks · updated today</p>
		</div>
		<div class="head-actions">
			<div class="theme-toggle">
				<button
					type="button"
					class="theme-btn"
					class:active={$theme === 'light'}
					on:click={() => pickTheme('light')}
					aria-pressed={$theme === 'light'}
				>
					Light
				</button>
				<button
					type="button"
					class="theme-btn"
					class:active={$theme === 'dark'}
					on:click={() => pickTheme('dark')}
					aria-pressed={$theme === 'dark'}
				>
					Dark
				</button>
			</div>
			<!--span class="pill oi-mono" aria-hidden="true">All sports ▾</span>
			<a class="btn" href="/settings/export">Export</a-->
			<a class="btn btn-primary" href="/activities/upload">Upload .fit</a>
		</div>
	</header>

	<div class="kpi-strip">
		{#each kpiCards as k}
			<div class="kpi" style="border-top-color: {k.accent}">
				<div class="kpi-head">
					<div class="kpi-label oi-mono" title={k.tip}>{k.label}</div>
					{#if k.ind.zoneWidth > 0}
						<div
							class="kpi-status oi-mono"
							style="color: var(--st-{k.ind.tone}); background: var(--st-{k.ind.tone}-bg)"
						>
							{k.ind.status}
						</div>
					{/if}
				</div>
				<div class="kpi-val oi-mono">{k.val}</div>
				<div class="kpi-sub oi-mono">{k.sub}</div>
				{#if k.ind.zoneWidth > 0}
					<div class="kpi-track">
						<div
							class="kpi-zone"
							style="left: {k.ind.zoneStart}%; width: {k.ind.zoneWidth}%; background: var(--st-{k.ind
								.tone}-tint)"
						></div>
					</div>
					<div class="kpi-marker-row">
						<div
							class="kpi-marker"
							style="left: {k.ind.markerPct}%; background: var(--st-{k.ind.tone})"
						></div>
					</div>
					<div class="kpi-scale oi-mono">
						<span>{k.ind.lo}</span>
						<span style="color: var(--st-{k.ind.tone})">ideal</span>
						<span>{k.ind.hi}</span>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="row-pmc">
		<div class="card pmc-card">
			<div class="card-head">
				<div class="card-head-left">
					<div class="card-title">Training load</div>
					<div class="legend">
						<span class="legend-item">
							<span class="legend-swatch" style="background: var(--c-fit)"></span>Fitness
						</span>
						<span class="legend-item">
							<span class="legend-swatch" style="background: var(--c-fat)"></span>Fatigue
						</span>
						<span class="legend-item">
							<span class="legend-swatch" style="background: var(--c-form)"></span>Form
						</span>
					</div>
				</div>
				<div class="range">
					{#each RANGES as r}
						<button
							type="button"
							class="range-btn"
							class:active={range === r.key}
							on:click={() => (range = r.key)}
							aria-pressed={range === r.key}
						>
							{r.label}
						</button>
					{/each}
				</div>
			</div>
			<div class="pmc-wrap">
				<svg
					width="100%"
					height={PMC_VIEW_H}
					viewBox="0 0 {PMC_W} {PMC_VIEW_H}"
					preserveAspectRatio="none"
					role="img"
					aria-label="Training load over time"
					style="cursor: crosshair"
					on:mousemove={onPmcMove}
					on:mouseleave={() => (pmcHoverIdx = null)}
				>
					{#each pmcGeo.gridLines as g}
						<line x1={PMC_PAD_L} y1={g.y} x2={PMC_W - PMC_PAD_L} y2={g.y} stroke="var(--grid)" stroke-width="1" />
					{/each}
					<line
						x1={PMC_PAD_L}
						y1={pmcGeo.zeroY}
						x2={PMC_W - PMC_PAD_L}
						y2={pmcGeo.zeroY}
						stroke="var(--zero)"
						stroke-width="1"
						stroke-dasharray="2 3"
					/>
					<polygon points={pmcGeo.formArea} fill="var(--c-form)" opacity="0.08" />
					<polyline points={pmcGeo.formPts} fill="none" stroke="var(--c-form)" stroke-width="1.5" stroke-linejoin="round" />
					<polyline points={pmcGeo.fatiguePts} fill="none" stroke="var(--c-fat)" stroke-width="1.75" stroke-linejoin="round" />
					<polyline points={pmcGeo.fitnessPts} fill="none" stroke="var(--c-fit)" stroke-width="2.25" stroke-linejoin="round" />
					{#if pmcHover}
						<line x1={pmcHover.x} y1="6" x2={pmcHover.x} y2="164" stroke="var(--ink2)" stroke-width="1" opacity="0.4" />
						<circle cx={pmcHover.x} cy={pmcHover.fitY} r="3.3" fill="var(--c-fit)" />
						<circle cx={pmcHover.x} cy={pmcHover.fatY} r="3.3" fill="var(--c-fat)" />
						<circle cx={pmcHover.x} cy={pmcHover.formY} r="3.3" fill="var(--c-form)" />
					{/if}
				</svg>
				{#each pmcGeo.gridLines as g}
					<span class="axis-y oi-mono" style="top: {g.y}px">{g.label}</span>
				{/each}
				{#each pmcGeo.xLabels as x}
					<span class="axis-x oi-mono" style="left: {(parseFloat(x.x) / PMC_W) * 100}%">{x.label}</span>
				{/each}
				{#if pmcHover}
					<div class="tip pmc-tip" style="left: {pmcHover.leftPct}">
						<div class="tip-date oi-mono">{pmcHover.date}</div>
						<div class="tip-row">
							<span class="tip-fit">Fitness</span><span class="oi-mono">{pmcHover.fit}</span>
						</div>
						<div class="tip-row">
							<span class="tip-fat">Fatigue</span><span class="oi-mono">{pmcHover.fat}</span>
						</div>
						<div class="tip-row">
							<span class="tip-form">Form</span><span class="oi-mono">{pmcHover.form}</span>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="side-col">
			<div class="card readiness-card">
				<svg width="74" height="74" viewBox="0 0 130 130" aria-hidden="true">
					<circle cx="65" cy="65" r={READ_R} fill="none" stroke="var(--grid)" stroke-width="13" />
					<circle
						cx="65"
						cy="65"
						r={READ_R}
						fill="none"
						stroke="var(--green)"
						stroke-width="13"
						stroke-linecap="round"
						stroke-dasharray={readinessDash}
						transform="rotate(-90 65 65)"
					/>
					<text x="65" y="64" text-anchor="middle" class="oi-mono ring-val">{dashboard.kpis.readinessVal}</text>
					<text x="65" y="83" text-anchor="middle" class="oi-mono ring-sub">/100</text>
				</svg>
				<div>
					<div class="readiness-label oi-mono" title={STAT_TIPS.readiness}>Readiness</div>
					<div class="readiness-state">{dashboard.kpis.readinessLabel}</div>
					<div class="readiness-hint">Based on TSB. Updated today.</div>
				</div>
			</div>

			<div class="card split-card">
				<div class="split-cell">
					<div class="split-label oi-mono" title={STAT_TIPS.monotony}>Monotony</div>
					<div class="split-val oi-mono">{dashboard.kpis.monotony}</div>
				</div>
				<div class="split-divider"></div>
				<div class="split-cell">
					<div class="split-label oi-mono" title={STAT_TIPS.strain}>Strain</div>
					<div class="split-val oi-mono">{dashboard.kpis.strain}</div>
				</div>
			</div>

			<div class="card sport-card">
				<div class="card-eyebrow oi-mono">Sport split · load</div>
				<div class="sport-body">
					<svg width="68" height="68" viewBox="0 0 120 120" aria-hidden="true">
						<circle
							cx="60"
							cy="60"
							r={DONUT_R}
							fill="none"
							stroke="var(--swim)"
							stroke-width="16"
							stroke-dasharray={donut.swim.dash}
							stroke-dashoffset={donut.swim.offset}
							transform="rotate(-90 60 60)"
						/>
						<circle
							cx="60"
							cy="60"
							r={DONUT_R}
							fill="none"
							stroke="var(--bike)"
							stroke-width="16"
							stroke-dasharray={donut.bike.dash}
							stroke-dashoffset={donut.bike.offset}
							transform="rotate(-90 60 60)"
						/>
						<circle
							cx="60"
							cy="60"
							r={DONUT_R}
							fill="none"
							stroke="var(--run)"
							stroke-width="16"
							stroke-dasharray={donut.run.dash}
							stroke-dashoffset={donut.run.offset}
							transform="rotate(-90 60 60)"
						/>
					</svg>
					<div class="sport-legend">
						<div class="sport-row">
							<span class="sport-key"><span class="sport-chip" style="background: var(--swim)"></span>Swim</span>
							<span class="oi-mono sport-pct">{dashboard.sport.swimPct}%</span>
						</div>
						<div class="sport-row">
							<span class="sport-key"><span class="sport-chip" style="background: var(--bike)"></span>Bike</span>
							<span class="oi-mono sport-pct">{dashboard.sport.bikePct}%</span>
						</div>
						<div class="sport-row">
							<span class="sport-key"><span class="sport-chip" style="background: var(--run)"></span>Run</span>
							<span class="oi-mono sport-pct">{dashboard.sport.runPct}%</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="row-bottom">
		<div class="card volume-card">
			<div class="card-head">
				<div class="card-title">
					Weekly volume <span class="card-title-sub">· by sport</span>
				</div>
				<div class="mini-legend">
					<span class="legend-item-sm"><span class="legend-swatch-sm" style="background: var(--swim)"></span>Swim</span>
					<span class="legend-item-sm"><span class="legend-swatch-sm" style="background: var(--bike)"></span>Bike</span>
					<span class="legend-item-sm"><span class="legend-swatch-sm" style="background: var(--run)"></span>Run</span>
				</div>
			</div>
			<div class="bars-wrap">
				<svg
					width="100%"
					height={BAR_VIEW_H}
					viewBox="0 0 {BAR_W} {BAR_VIEW_H}"
					preserveAspectRatio="none"
					on:mousemove={onBarMove}
					on:mouseleave={() => (barHoverIdx = null)}
					role="img"
					aria-label="Weekly training volume by sport"
				>
					<line x1={BAR_PAD_L} y1={BAR_BASE_Y} x2={BAR_W - BAR_PAD_L} y2={BAR_BASE_Y} stroke="var(--grid)" stroke-width="1" />
					{#each bars as b}
						<g data-bi={b.i} style="cursor: pointer">
							<rect x={b.x} y={BAR_PAD_T} width={b.barW} height={BAR_INNER_H} fill="transparent" />
							<rect x={b.x} y={b.runY} width={b.barW} height={b.runH} fill="var(--run)" />
							<rect x={b.x} y={b.bikeY} width={b.barW} height={b.bikeH} fill="var(--bike)" />
							<rect x={b.x} y={b.swimY} width={b.barW} height={b.swimH} fill="var(--swim)" />
						</g>
					{/each}
				</svg>
				{#each bars as b}
					<span class="bar-label oi-mono" style="left: {(b.cx / BAR_W) * 100}%">{b.label}</span>
				{/each}
				{#if barHover}
					<div class="tip bar-tip" style="left: {barHover.leftPct}">
						<div class="tip-head">
							<span class="tip-fit">{barHover.label}</span><span class="oi-mono">{barHover.total}</span>
						</div>
						<div class="tip-row">
							<span class="tip-swim">Swim</span><span class="oi-mono">{barHover.swim}</span>
						</div>
						<div class="tip-row">
							<span class="tip-fat">Bike</span><span class="oi-mono">{barHover.bike}</span>
						</div>
						<div class="tip-row">
							<span class="tip-fit">Run</span><span class="oi-mono">{barHover.run}</span>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="card zones-card">
			<div class="card-title">Time in zone</div>
			{#if dashboard.zones.length > 0}
				<div class="zones-body">
					{#each dashboard.zones as z}
						<div>
							<div class="zone-row">
								<span class="zone-name">{z.name}</span>
								<span class="oi-mono zone-pct">{z.pct}%</span>
							</div>
							<div class="zone-track">
								<div class="zone-fill" style="width: {z.w}; background: {z.color}"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="card-empty">No heart-rate data in this period.</div>
			{/if}
		</div>

		<div class="card power-card">
			<div class="card-head-small">
				<div class="card-title">Power profile</div>
				<span class="oi-mono power-period">12 wk · W</span>
			</div>
			{#if dashboard.power.length > 0}
				{@const powerMax = Math.max(...dashboard.power.map((q) => q.val))}
				<div class="power-body">
					{#each dashboard.power as p}
						<div class="power-row">
							<span class="oi-mono power-label">{p.label}</span>
							<div class="power-track">
								<div class="power-fill" style="width: {powerMax > 0 ? Math.round((p.val / powerMax) * 100) : 0}%"></div>
							</div>
							<span class="oi-mono power-val">{p.val}</span>
						</div>
					{/each}
				</div>
			{:else}
				<div class="card-empty">No power data — connect a power meter to see your profile.</div>
			{/if}
		</div>
	</div>

	{#if dashboard.recent.length > 0}
		<div class="card recent-card">
			<div class="recent-head">
				<div class="card-title">Recent activities</div>
				<a class="recent-view-all" href="/activities">View all →</a>
			</div>
			<div class="recent-table">
				<div class="recent-thead">
					<span class="recent-th oi-mono">Date</span>
					<span class="recent-th oi-mono">Sport</span>
					<span class="recent-th oi-mono">Title</span>
					<span class="recent-th oi-mono right">Dist</span>
					<span class="recent-th oi-mono right">Time</span>
					<span class="recent-th oi-mono right">TSS</span>
				</div>
				{#each dashboard.recent as r}
					<a class="recent-row" href="/activities/{r.id}" title={r.title}>
						<span class="recent-cell oi-mono recent-date">{r.date}</span>
						<span class="recent-cell">
							<span class="recent-tag oi-mono" style="background: {r.color}">{r.tag}</span>
						</span>
						<span class="recent-cell recent-title">{r.title}</span>
						<span class="recent-cell oi-mono right">{r.distanceLabel} {r.distanceUnitLabel}</span>
						<span class="recent-cell oi-mono right">{r.durationLabel}</span>
						<span class="recent-cell oi-mono right recent-tss">{r.tss}</span>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</section>

<style>
	.dash {
		display: flex;
		flex-direction: column;
		gap: 11px;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 3px;
	}
	.title {
		font-size: 22px;
		font-weight: 700;
		color: var(--ink2);
		line-height: 1;
		margin: 0;
	}
	.subtitle {
		font-size: 11px;
		color: var(--muted);
		margin: 5px 0 0;
	}

	.head-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.theme-toggle {
		display: flex;
		background: var(--btn);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 2px;
	}
	.theme-btn {
		font: 600 11px 'Archivo', system-ui, sans-serif;
		padding: 6px 12px;
		border-radius: 6px;
		cursor: pointer;
		border: none;
		background: transparent;
		color: var(--btn-ink);
	}
	.theme-btn.active {
		background: var(--green);
		color: #fff;
	}
	.btn {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: var(--btn-ink);
		background: var(--btn);
		border: 1px solid var(--line);
		border-radius: 7px;
		padding: 8px 13px;
		cursor: pointer;
		text-decoration: none;
		line-height: 1.2;
	}
	.btn-primary {
		color: #fff;
		background: var(--green);
		border-color: transparent;
		padding: 8px 14px;
	}

	.kpi-strip {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 9px;
	}
	.kpi {
		background: var(--card);
		border: 1px solid var(--line);
		border-top: 2px solid var(--c-fit);
		border-radius: 8px;
		padding: 11px 13px;
	}
	.kpi-label {
		font-size: 8.5px;
		letter-spacing: 0.08em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.kpi-val {
		font-size: 25px;
		font-weight: 600;
		color: var(--ink);
		margin-top: 6px;
		line-height: 1;
	}
	.kpi-sub {
		font-size: 9.5px;
		color: var(--muted);
		margin-top: 5px;
	}
	.kpi-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 6px;
	}
	.kpi-status {
		font-size: 8.5px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: 4px;
		white-space: nowrap;
	}
	/* Combination indicator: neutral track + shaded ideal band + value marker. */
	.kpi-track {
		position: relative;
		height: 6px;
		border-radius: 3px;
		background: var(--track);
		overflow: hidden;
		margin-top: 11px;
	}
	.kpi-zone {
		position: absolute;
		top: 0;
		bottom: 0;
	}
	.kpi-marker-row {
		position: relative;
		height: 0;
	}
	.kpi-marker {
		position: absolute;
		top: -9px;
		transform: translateX(-50%);
		width: 9px;
		height: 9px;
		border-radius: 50%;
		box-shadow: 0 0 0 2px var(--card);
	}
	.kpi-scale {
		display: flex;
		justify-content: space-between;
		font-size: 8px;
		color: var(--faint);
		margin-top: 9px;
	}

	.row-pmc {
		display: grid;
		grid-template-columns: 1fr 244px;
		gap: 11px;
	}
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 14px 16px;
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}
	.card-head-small {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 10px;
	}
	.card-head-left {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}
	.card-title-sub {
		font-weight: 500;
		color: var(--faint);
		font-size: 11px;
	}
	.card-eyebrow {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
		margin-bottom: 10px;
	}

	.legend {
		display: flex;
		gap: 11px;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.legend-swatch {
		width: 10px;
		height: 3px;
		border-radius: 2px;
	}

	.range {
		display: flex;
		gap: 5px;
	}
	.range-btn {
		font: 600 10.5px 'Archivo', system-ui, sans-serif;
		padding: 5px 10px;
		border-radius: 6px;
		cursor: pointer;
		border: 1px solid var(--line);
		background: var(--btn);
		color: var(--btn-ink);
	}
	.range-btn.active {
		background: var(--rail);
		color: var(--gold);
		border-color: transparent;
	}

	.pmc-card {
		display: flex;
		flex-direction: column;
		padding: 14px 16px;
	}
	.pmc-wrap {
		position: relative;
		width: 100%;
		flex: 1;
	}
	.axis-y {
		position: absolute;
		right: 0;
		transform: translateY(-50%);
		font-size: 8px;
		color: var(--faint);
		line-height: 1;
		pointer-events: none;
	}
	.axis-x {
		position: absolute;
		top: 168px;
		transform: translateX(-50%);
		font-size: 8.5px;
		color: var(--faint);
		line-height: 1;
		pointer-events: none;
	}
	.bar-label {
		position: absolute;
		bottom: 0;
		transform: translateX(-50%);
		font-size: 8.5px;
		color: var(--faint);
		line-height: 1;
		pointer-events: none;
	}

	.tip {
		position: absolute;
		top: 2px;
		transform: translateX(-50%);
		pointer-events: none;
		background: var(--tip);
		color: #fff;
		border-radius: 6px;
		padding: 7px 9px;
		min-width: 100px;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
	}
	.tip-date {
		font-size: 9.5px;
		color: #9bbaa8;
		margin-bottom: 6px;
	}
	.tip-row,
	.tip-head {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1.5;
	}
	.tip-head {
		font-size: 10px;
		font-weight: 700;
		margin-bottom: 6px;
	}
	.tip-fit {
		color: #7fc090;
	}
	.tip-fat {
		color: #e7c24b;
	}
	.tip-form {
		color: #aeb9c9;
	}
	.tip-swim {
		color: #8fc0dd;
	}

	.side-col {
		display: flex;
		flex-direction: column;
		gap: 11px;
	}
	.readiness-card {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 13px 14px;
	}
	.ring-val {
		font-size: 30px;
		font-weight: 600;
		fill: var(--ink);
	}
	.ring-sub {
		font-size: 9px;
		fill: var(--faint);
	}
	.readiness-label {
		font-size: 8.5px;
		letter-spacing: 0.08em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.readiness-state {
		font-size: 15px;
		font-weight: 700;
		color: var(--green);
		margin-top: 4px;
	}
	.readiness-hint {
		font-size: 10px;
		color: var(--muted);
		margin-top: 4px;
		line-height: 1.45;
	}

	.split-card {
		display: flex;
		gap: 10px;
		padding: 12px 14px;
	}
	.split-cell {
		flex: 1;
	}
	.split-label {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.split-val {
		font-size: 20px;
		font-weight: 600;
		color: var(--ink);
		margin-top: 5px;
	}
	.split-divider {
		width: 1px;
		background: var(--line);
	}

	.sport-card {
		padding: 13px 14px;
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.sport-body {
		display: flex;
		align-items: center;
		gap: 13px;
		flex: 1;
	}
	.sport-legend {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.sport-row {
		display: flex;
		justify-content: space-between;
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.sport-key {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.sport-chip {
		width: 7px;
		height: 7px;
		border-radius: 2px;
	}
	.sport-pct {
		color: var(--muted);
	}

	.row-bottom {
		display: grid;
		grid-template-columns: 1.5fr 1fr 1fr;
		gap: 11px;
	}
	.volume-card {
		display: flex;
		flex-direction: column;
		padding: 13px 15px;
	}
	.bars-wrap {
		position: relative;
		width: 100%;
		flex: 1;
	}
	.mini-legend {
		display: flex;
		gap: 9px;
	}
	.legend-item-sm {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 9px;
		font-weight: 600;
		color: var(--muted);
	}
	.legend-swatch-sm {
		width: 7px;
		height: 7px;
		border-radius: 2px;
	}

	.zones-card {
		display: flex;
		flex-direction: column;
		padding: 13px 15px;
	}
	.card-empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 16px 8px;
		font-size: 10.5px;
		line-height: 1.4;
		color: var(--muted);
	}
	.zones-body {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		flex: 1;
		gap: 8px;
		margin-top: 10px;
	}
	.zone-row {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		font-weight: 600;
		color: var(--ink-soft);
		margin-bottom: 3px;
	}
	.zone-name {
		white-space: nowrap;
	}
	.zone-pct {
		color: var(--faint);
	}
	.zone-track {
		height: 6px;
		background: var(--track);
		border-radius: 3px;
		overflow: hidden;
	}
	.zone-fill {
		height: 100%;
	}

	.power-card {
		display: flex;
		flex-direction: column;
		padding: 13px 15px;
	}
	.power-period {
		font-size: 9px;
		color: var(--faint);
	}
	.power-body {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		flex: 1;
		gap: 8px;
	}
	.power-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.power-label {
		font-size: 9.5px;
		color: var(--muted);
		width: 36px;
	}
	.power-track {
		flex: 1;
		height: 7px;
		background: var(--track);
		border-radius: 3px;
		overflow: hidden;
	}
	.power-fill {
		height: 100%;
		background: var(--green);
	}
	.power-val {
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink);
		width: 36px;
		text-align: right;
	}

	.recent-card {
		padding: 13px 16px 4px;
	}
	.recent-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 10px;
	}
	.recent-view-all {
		font: 600 11px 'Archivo', system-ui, sans-serif;
		color: var(--green);
		text-decoration: none;
	}
	.recent-view-all:hover {
		text-decoration: underline;
	}
	.recent-table {
		display: flex;
		flex-direction: column;
	}
	.recent-thead,
	.recent-row {
		display: grid;
		grid-template-columns: 90px 56px minmax(0, 1fr) 72px 60px 52px;
		align-items: center;
		gap: 0;
	}
	.recent-thead {
		padding: 0 4px 7px;
		border-bottom: 1px solid var(--line);
	}
	.recent-th {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: var(--muted);
		text-transform: uppercase;
		font-weight: 600;
	}
	.recent-th.right {
		text-align: right;
	}
	.recent-row {
		padding: 0 4px;
		border-bottom: 1px solid var(--line);
		text-decoration: none;
		transition: background 120ms ease;
	}
	.recent-row:last-of-type {
		border-bottom: none;
	}
	.recent-row:hover {
		background: var(--bg-soft);
	}
	.recent-cell {
		padding: 9px 0;
		font-size: 11px;
		color: var(--ink-soft);
	}
	.recent-cell.right {
		text-align: right;
	}
	.recent-date {
		font-size: 10.5px;
		color: var(--ink-soft);
	}
	.recent-tag {
		font-size: 8.5px;
		font-weight: 600;
		color: #fff;
		border-radius: 3px;
		padding: 2px 6px;
	}
	.recent-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink);
		padding-right: 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.recent-tss {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink2);
	}

	/* ── Responsive ──────────────────────────────────────────────────────
	   Progressive degradation: 6-col KPI → 3-col tablet → 2-col phone.
	   Both rows collapse to single column below tablet; side-col cards go
	   horizontal at tablet so they don't waste vertical space. */

	@media (max-width: 1199px) {
		.kpi-strip {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 899px) {
		.row-pmc {
			grid-template-columns: minmax(0, 1fr);
		}
		.side-col {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 11px;
		}
		.side-col > .card {
			flex: 1 1 calc(33% - 8px);
			min-width: 0;
		}
		.row-bottom {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 639px) {
		.kpi-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.side-col {
			flex-direction: column;
		}
		.side-col > .card {
			flex: none;
		}
		.head {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}
		.head-actions {
			flex-wrap: wrap;
		}
		.card-head {
			flex-wrap: wrap;
			gap: 8px;
		}
		.card-head-left {
			flex-wrap: wrap;
		}
		.recent-thead,
		.recent-row {
			grid-template-columns: 64px 50px minmax(0, 1fr) 44px;
		}
		.recent-thead > :nth-child(4),
		.recent-thead > :nth-child(5),
		.recent-row > :nth-child(4),
		.recent-row > :nth-child(5) {
			display: none; /* Drop Dist + Time on phone — Date/Sport/Title/TSS suffice */
		}
		.recent-card {
			padding: 12px 12px 4px;
		}
	}

	/* Stat labels carry an explanatory native tooltip — hint it with the cursor. */
	.kpi-label,
	.readiness-label,
	.split-label {
		cursor: help;
	}
</style>
