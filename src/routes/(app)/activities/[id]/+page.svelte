<script lang="ts">
	import type { PageData } from './$types';
	import BackLink from '$lib/components/ui/BackLink.svelte';
	import { formatPercent as pct } from '$lib/units';

	export let data: PageData;
	$: detail = data.detail;
	$: activity = detail.activity;
	$: chart = detail.chart;

	// Native-tooltip explanations for the calculated summary stats (the rest —
	// duration, distance, HR, etc. — are raw measurements that need none).
	const STAT_TIPS: Record<string, string> = {
		TSS: "TSS (Training Stress Score): this session's training load — roughly hours × intensity² × 100, or a sport-based estimate when power/HR is missing. Higher means more demanding; it's what feeds your Fitness and Fatigue.",
		IF: 'IF (Intensity Factor): how hard this session was relative to your threshold (1.0 = right at threshold). Use it to tell an easy session from tempo from a threshold-plus effort.'
	};

	// Chart sizing
	const CHART_W = 640;
	const CHART_VIEW_H = 208;
	const CHART_PAD_L = 6;
	const CHART_PAD_T = 6;
	const CHART_INNER_H = 170;
	const CHART_INNER_W = CHART_W - 2 * CHART_PAD_L;

	let hoverIdx: number | null = null;

	$: hrRange = (() => {
		if (chart.hr.length === 0) return { min: 0, max: 1 };
		const mn = Math.min(...chart.hr) - 6;
		const mx = Math.max(...chart.hr) + 6;
		return { min: mn, max: mx === mn ? mx + 1 : mx };
	})();
	$: paceRange = (() => {
		if (chart.paceSec.length === 0) return { min: 0, max: 1 };
		const mn = Math.min(...chart.paceSec) - 8;
		const mx = Math.max(...chart.paceSec) + 8;
		return { min: mn, max: mx === mn ? mx + 1 : mx };
	})();

	$: chartGeo = (() => {
		const n = chart.n;
		if (n === 0) return { hrPts: '', pacePts: '', hrArea: '', gridLines: [], xLabels: [], X: () => 0 };
		const X = (i: number) => CHART_PAD_L + (i / Math.max(1, n - 1)) * CHART_INNER_W;
		const hrY = (v: number) =>
			CHART_PAD_T + ((hrRange.max - v) / (hrRange.max - hrRange.min)) * CHART_INNER_H;
		// Lower pace seconds = faster = higher position. Standard practice for run pace charts.
		const paceY = (v: number) =>
			CHART_PAD_T + ((v - paceRange.min) / (paceRange.max - paceRange.min)) * CHART_INNER_H;

		const hrPts = chart.hr.map((v, i) => `${X(i).toFixed(1)},${hrY(v).toFixed(1)}`).join(' ');
		const pacePts = chart.paceSec.map((v, i) => `${X(i).toFixed(1)},${paceY(v).toFixed(1)}`).join(' ');
		const hrArea = `${CHART_PAD_L},${(CHART_PAD_T + CHART_INNER_H).toFixed(1)} ${hrPts} ${X(n - 1).toFixed(1)},${(CHART_PAD_T + CHART_INNER_H).toFixed(1)}`;

		const gridLines: { y: string; label: number }[] = [];
		for (let k = 0; k <= 3; k++) {
			const v = hrRange.min + ((hrRange.max - hrRange.min) * (3 - k)) / 3;
			gridLines.push({ y: hrY(v).toFixed(1), label: Math.round(v) });
		}
		const xLabels: { x: string; label: string }[] = [];
		const dur = chart.durationSec;
		if (dur > 0) {
			for (let k = 0; k < 5; k++) {
				const i = Math.round((k / 4) * (n - 1));
				const t = (i / Math.max(1, n - 1)) * dur;
				xLabels.push({ x: X(i).toFixed(1), label: fmtClock(t) });
			}
		}
		return { hrPts, pacePts, hrArea, gridLines, xLabels, X };
	})();

	$: hoverData = (() => {
		const i = hoverIdx;
		if (i === null) return null;
		if (chart.hr[i] === undefined && chart.paceSec[i] === undefined) return null;
		const xPx = chartGeo.X(i);
		const hrY = (v: number) =>
			CHART_PAD_T + ((hrRange.max - v) / (hrRange.max - hrRange.min)) * CHART_INNER_H;
		const paceY = (v: number) =>
			CHART_PAD_T + ((v - paceRange.min) / (paceRange.max - paceRange.min)) * CHART_INNER_H;
		const t = (i / Math.max(1, chart.n - 1)) * chart.durationSec;
		return {
			xPx,
			leftPct: `${((xPx / CHART_W) * 100).toFixed(2)}%`,
			hrY: chart.hr[i] !== undefined ? hrY(chart.hr[i]!).toFixed(1) : null,
			paceY: chart.paceSec[i] !== undefined ? paceY(chart.paceSec[i]!).toFixed(1) : null,
			time: fmtClock(t),
			hr: chart.hr[i] !== undefined ? `${Math.round(chart.hr[i]!)} bpm` : null,
			pace: chart.paceSec[i] !== undefined ? `${fmtPace(chart.paceSec[i]!)}/km` : null
		};
	})();

	function fmtClock(sec: number): string {
		const s = Math.round(sec);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const ss = s % 60;
		if (h > 0)
			return `${h}:${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
		return `${m}:${ss.toString().padStart(2, '0')}`;
	}

	function fmtPace(secPerKm: number): string {
		const m = Math.floor(secPerKm / 60);
		const s = Math.round(secPerKm % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function onChartMove(e: MouseEvent) {
		if (chart.n === 0) return;
		const target = e.currentTarget as SVGGraphicsElement;
		const css = target.getBoundingClientRect().width || 1;
		const userX = (e.offsetX / css) * CHART_W;
		const chartX = userX - CHART_PAD_L;
		const frac = Math.max(0, Math.min(1, chartX / CHART_INNER_W));
		const i = Math.round(frac * Math.max(0, chart.n - 1));
		if (hoverIdx !== i) hoverIdx = i;
	}

</script>

<section class="detail">
	<header class="head">
		<div class="head-left">
			<BackLink fallback="/activities" fallbackLabel="activities" />
			<div>
				<div class="title-row">
					<h1 class="title">{activity.title}</h1>
					<span class="sport-tag oi-mono" style="background: {activity.sportColor}">
						{activity.sportTag}
					</span>
				</div>
				<p class="date oi-mono">{activity.dateLabel}</p>
			</div>
		</div>
		<div class="head-actions">
			{#if detail.file}
				<a class="btn" href="/activities/files/{detail.file.id}/download">Export .fit</a>
			{/if}
			<form
				method="POST"
				action="?/delete"
				on:submit={(e) => {
					if (!confirm(`Delete "${activity.title}"? This permanently removes the activity, its streams, and the original file.`)) {
						e.preventDefault();
					}
				}}
			>
				<button type="submit" class="btn btn-danger">Delete</button>
			</form>
		</div>
	</header>

	<div class="stats-strip">
		{#each detail.summaryStats as s}
			<div class="stat-card">
				<div class="stat-label oi-mono" class:has-tip={!!STAT_TIPS[s.label]} title={STAT_TIPS[s.label] ?? null}>{s.label}</div>
				<div class="stat-val oi-mono">
					{s.val}{#if s.unit}<span class="stat-unit"> {s.unit}</span>{/if}
				</div>
			</div>
		{/each}
	</div>

	<div class="grid">
		<div class="left-col">
			<div class="card chart-card">
				<div class="card-head">
					<div class="card-title">Heart rate &amp; pace</div>
					<div class="chart-legend">
						{#if chart.hr.length > 0}
							<span class="legend-item">
								<span class="legend-swatch hr-swatch"></span>HR (bpm)
							</span>
						{/if}
						{#if chart.hasPace}
							<span class="legend-item">
								<span class="legend-swatch pace-swatch"></span>Pace (/km)
							</span>
						{/if}
					</div>
				</div>
				{#if chart.available}
					<div class="chart-wrap">
						<svg
							width="100%"
							height={CHART_VIEW_H}
							viewBox="0 0 {CHART_W} {CHART_VIEW_H}"
							preserveAspectRatio="none"
							role="img"
							aria-label="Heart rate and pace over time"
							style="cursor: crosshair"
							on:mousemove={onChartMove}
							on:mouseleave={() => (hoverIdx = null)}
						>
							{#each chartGeo.gridLines as g}
								<line
									x1={CHART_PAD_L}
									y1={g.y}
									x2={CHART_W - CHART_PAD_L}
									y2={g.y}
									stroke="var(--grid)"
									stroke-width="1"
								/>
							{/each}
							{#if chart.hr.length > 0}
								<polygon points={chartGeo.hrArea} fill="var(--green)" opacity="0.06" />
								<polyline points={chartGeo.hrPts} fill="none" stroke="var(--green)" stroke-width="1.9" stroke-linejoin="round" />
							{/if}
							{#if chart.hasPace}
								<polyline points={chartGeo.pacePts} fill="none" stroke="var(--bike)" stroke-width="1.5" stroke-linejoin="round" opacity="0.9" />
							{/if}
							{#if hoverData}
								<line x1={hoverData.xPx} y1="6" x2={hoverData.xPx} y2="176" stroke="var(--ink2)" stroke-width="1" opacity="0.4" />
								{#if hoverData.hrY}
									<circle cx={hoverData.xPx} cy={hoverData.hrY} r="3.3" fill="var(--green)" />
								{/if}
								{#if hoverData.paceY}
									<circle cx={hoverData.xPx} cy={hoverData.paceY} r="3.3" fill="var(--bike)" />
								{/if}
							{/if}
						</svg>
						{#each chartGeo.gridLines as g}
							<span class="axis-y oi-mono" style="top: {g.y}px">{g.label}</span>
						{/each}
						{#each chartGeo.xLabels as x}
							<span class="axis-x oi-mono" style="left: {(parseFloat(x.x) / CHART_W) * 100}%">{x.label}</span>
						{/each}
						{#if hoverData}
							<div class="chart-tip" style="left: {hoverData.leftPct}">
								<div class="tip-time oi-mono">{hoverData.time}</div>
								{#if hoverData.hr}
									<div class="tip-row"><span class="tip-hr">HR</span><span class="oi-mono">{hoverData.hr}</span></div>
								{/if}
								{#if hoverData.pace}
									<div class="tip-row"><span class="tip-pace">Pace</span><span class="oi-mono">{hoverData.pace}</span></div>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<div class="chart-empty oi-mono">No stream data available for this activity.</div>
				{/if}
			</div>

			{#if detail.laps.length > 0}
				<div class="card laps-card">
					<div class="laps-head">
						<div class="card-title">Laps</div>
						<span class="laps-count oi-mono">{detail.laps.length} splits</span>
					</div>
					<div class="laps-grid">
						<div class="lap-col-h oi-mono">Lap</div>
						<div class="lap-col-h oi-mono">Distance</div>
						<div class="lap-col-h oi-mono">Time</div>
						<div class="lap-col-h oi-mono">Pace</div>
						<div class="lap-col-h oi-mono">Avg HR</div>
						{#each detail.laps as l}
							<div class="lap-cell lap-label-cell oi-mono lap-{l.kind}">{l.label}</div>
							<div class="lap-cell oi-mono lap-{l.kind}">{l.distance}</div>
							<div class="lap-cell oi-mono lap-{l.kind}">{l.time}</div>
							<div class="lap-cell oi-mono lap-pace lap-{l.kind}">{l.pace}</div>
							<div class="lap-cell lap-hr-cell lap-{l.kind}">
								<span class="lap-hr-track">
									<span class="lap-hr-fill lap-{l.kind}-bar" style="width: {l.hrWidth}"></span>
								</span>
								<span class="oi-mono lap-hr-val">{l.avgHr ?? '—'}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="right-col">
			<div class="card route-card">
				<div class="card-head-small">
					<div class="card-title-sm">Route</div>
					<span class="route-meta oi-mono">{detail.route.distanceLabel} {#if detail.route.elevationLabel}· {detail.route.elevationLabel}{/if}</span>
				</div>
				<div class="route-placeholder">
					<span class="route-placeholder-text oi-mono">
						{detail.route.hasGps ? 'GPS route map' : 'No GPS recorded'}
					</span>
				</div>
			</div>

			{#if detail.hrZones.length > 0}
				<div class="card zones-card">
					<div class="card-title-sm">Time in HR zone</div>
					<div class="zones-body">
						{#each detail.hrZones as z}
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
				</div>
			{/if}

			{#if detail.peaks.length > 0}
				<div class="card peaks-card">
					<div class="card-title-sm">Peak efforts</div>
					<div class="peaks-body">
						{#each detail.peaks as p}
							<div class="peak-row">
								<span class="peak-label">{p.label}</span>
								<span class="oi-mono peak-val">{p.val}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if detail.link && detail.planned}
				<div class="card link-card">
					<div class="card-title-sm">Planned workout</div>
					<p class="link-body">
						Linked <span class="link-pill oi-mono">{detail.link.matchType}</span>
						to <a class="link-link" href="/calendar/{detail.planned.id}/edit">{detail.planned.title}</a>
						<span class="link-date oi-mono">({detail.planned.scheduledDate})</span>
					</p>
					<p class="link-compliance oi-mono">
						Compliance: D {pct(detail.link.durationCompliance)} · Dist {pct(detail.link.distanceCompliance)} · Load {pct(detail.link.loadCompliance)}
					</p>
					<form method="POST" action="?/unlink">
						<button type="submit" class="btn btn-danger">Unlink</button>
					</form>
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: 13px;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.head-left {
		display: flex;
		align-items: flex-start;
		gap: 13px;
	}
	.title-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.title {
		font-size: 22px;
		font-weight: 700;
		color: var(--ink2);
		line-height: 1;
		margin: 0;
	}
	.sport-tag {
		font-size: 9.5px;
		font-weight: 600;
		color: #fff;
		border-radius: 4px;
		padding: 3px 7px;
	}
	.date {
		font-size: 11px;
		color: var(--muted);
		margin: 6px 0 0;
	}
	.head-actions {
		display: flex;
		gap: 8px;
	}
	.btn {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: var(--btn-ink);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 7px;
		padding: 8px 13px;
		cursor: pointer;
		text-decoration: none;
		line-height: 1.2;
	}
	.btn-danger {
		color: #fff;
		background: var(--danger);
		border-color: transparent;
	}

	.stats-strip {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: 8px;
	}
	.stat-card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 11px 13px;
		min-width: 0;
	}
	.stat-label {
		font-size: 8px;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Calculated stats (TSS, IF) carry an explanatory native tooltip. */
	.stat-label.has-tip {
		cursor: help;
	}
	.stat-val {
		font-size: 19px;
		font-weight: 600;
		color: var(--ink);
		margin-top: 6px;
		line-height: 1;
	}
	.stat-unit {
		font-size: 10px;
		color: var(--faint);
		font-weight: 500;
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 300px;
		gap: 11px;
		align-items: start;
	}
	.left-col,
	.right-col {
		display: flex;
		flex-direction: column;
		gap: 11px;
		min-width: 0;
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
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}
	.card-title-sm {
		font-size: 12.5px;
		font-weight: 700;
		color: var(--ink2);
		margin-bottom: 11px;
	}

	.chart-legend {
		display: flex;
		gap: 14px;
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
	.hr-swatch {
		background: var(--green);
	}
	.pace-swatch {
		background: var(--bike);
	}

	.chart-wrap {
		position: relative;
		width: 100%;
	}
	.axis-y {
		position: absolute;
		left: 0;
		transform: translateY(-100%);
		font-size: 8px;
		color: var(--faint);
		line-height: 1;
		pointer-events: none;
		padding-left: 2px;
	}
	.axis-x {
		position: absolute;
		top: 188px;
		transform: translateX(-50%);
		font-size: 8.5px;
		color: var(--faint);
		line-height: 1;
		pointer-events: none;
	}

	.chart-tip {
		position: absolute;
		top: 2px;
		transform: translateX(-50%);
		pointer-events: none;
		background: var(--tip);
		color: #fff;
		border-radius: 6px;
		padding: 7px 10px;
		min-width: 104px;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}
	.tip-time {
		font-size: 9.5px;
		color: #9bbaa8;
		margin-bottom: 6px;
	}
	.tip-row {
		display: flex;
		justify-content: space-between;
		gap: 14px;
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1.5;
	}
	.tip-hr {
		color: #7fc090;
	}
	.tip-pace {
		color: #e7c24b;
	}
	.chart-empty {
		padding: 28px 0;
		text-align: center;
		font-size: 11px;
		color: var(--faint);
	}

	.laps-card {
		min-width: 0;
	}
	.laps-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 9px;
	}
	.laps-count {
		font-size: 9.5px;
		color: var(--faint);
	}
	.laps-grid {
		display: grid;
		grid-template-columns: 46px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr);
		font-size: 10px;
	}
	.lap-col-h {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
		padding: 0 0 7px;
	}
	.lap-cell {
		padding: 7px 0;
		border-top: 1px solid var(--line);
		font-size: 11px;
		color: var(--ink-soft);
	}
	.lap-label-cell {
		font-weight: 600;
	}
	.lap-pace {
		font-weight: 600;
		color: var(--ink2);
	}
	.lap-hr-cell {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-right: 8px;
	}
	.lap-hr-track {
		flex: 1;
		min-width: 0;
		height: 5px;
		background: var(--track);
		border-radius: 3px;
		overflow: hidden;
	}
	.lap-hr-fill {
		display: block;
		height: 100%;
		background: var(--green);
	}
	.lap-hr-val {
		font-size: 10.5px;
		color: var(--ink-soft);
		width: 26px;
		text-align: right;
	}
	.lap-on {
		background: var(--run-soft);
	}
	.lap-on.lap-label-cell {
		color: var(--green);
	}
	.lap-on-bar {
		background: var(--c-fat);
	}
	.lap-warm {
		background: var(--bg-soft);
	}
	.lap-warm.lap-label-cell {
		color: var(--muted);
	}
	.lap-warm-bar {
		background: var(--green);
		opacity: 0.5;
	}
	.lap-off {
		background: transparent;
	}
	.lap-off.lap-label-cell {
		color: var(--faint);
	}
	.lap-off-bar {
		background: var(--green);
		opacity: 0.5;
	}

	.route-card {
		padding: 14px 16px;
	}
	.route-meta {
		font-size: 9px;
		color: var(--faint);
	}
	.route-placeholder {
		height: 148px;
		border-radius: 7px;
		border: 1px solid var(--line);
		background-image: repeating-linear-gradient(
			45deg,
			var(--bg-soft) 0 10px,
			var(--bg) 10px 20px
		);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.route-placeholder-text {
		font-size: 10px;
		color: var(--faint);
		letter-spacing: 0.04em;
	}

	.zones-body {
		display: flex;
		flex-direction: column;
		gap: 9px;
	}
	.zone-row {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		font-weight: 600;
		color: var(--ink-soft);
		margin-bottom: 3px;
	}
	.zone-pct {
		color: var(--faint);
	}
	.zone-track {
		height: 7px;
		background: var(--track);
		border-radius: 3px;
		overflow: hidden;
	}
	.zone-fill {
		height: 100%;
	}

	.peaks-body {
		display: flex;
		flex-direction: column;
	}
	.peak-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		border-top: 1px solid var(--line);
	}
	.peak-row:first-of-type {
		border-top: none;
		padding-top: 0;
	}
	.peak-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--ink-soft);
	}
	.peak-val {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink2);
	}

	.link-card form {
		margin-top: 8px;
	}
	.link-body {
		font-size: 11px;
		color: var(--ink-soft);
		margin: 0 0 6px;
	}
	.link-pill {
		font-size: 9px;
		color: var(--green);
		background: var(--run-soft);
		border-radius: 3px;
		padding: 1px 5px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.link-link {
		color: var(--ink2);
		font-weight: 600;
	}
	.link-date {
		font-size: 10px;
		color: var(--faint);
	}
	.link-compliance {
		font-size: 10px;
		color: var(--muted);
		margin: 0 0 10px;
	}

	/* ── Responsive ────────────────────────────────────────────────────── */

	@media (max-width: 1199px) {
		.stats-strip {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (max-width: 899px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 639px) {
		.stats-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 6px;
		}
		.stat-card {
			padding: 9px 11px;
		}
		.stat-val {
			font-size: 16px;
		}
		.head {
			flex-wrap: wrap;
			gap: 10px;
		}
		.head-actions {
			flex-wrap: wrap;
		}
		.title {
			font-size: 18px;
		}
		.title-row {
			flex-wrap: wrap;
		}
		.card {
			padding: 12px 13px;
		}
		.chart-legend {
			gap: 10px;
		}
		.axis-x {
			/* Tighten label spacing on small viewports where date strings
			   would otherwise collide. */
			font-size: 8px;
		}
		.laps-grid {
			/* Drop the HR bar at mobile widths — just show the numeric HR.
			   Bar visual carries little info on a phone-width column. */
			grid-template-columns: 38px minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr) 42px;
		}
		.lap-hr-track {
			display: none;
		}
		.lap-hr-cell {
			justify-content: flex-end;
			padding-right: 0;
		}
		.lap-hr-val {
			width: auto;
		}
		.peaks-card,
		.zones-card,
		.route-card,
		.link-card {
			padding: 12px 14px;
		}
		.route-placeholder {
			height: 110px;
		}
	}
</style>
