<script lang="ts">
	import type { PageData } from './$types';
	import {
		computePmcGeo,
		PMC_PAD_L,
		PMC_INNER_W,
		PMC_VIEW_H,
		PMC_W
	} from './chartGeometry';

	export let series: PageData['dashboard']['series'];

	type Range = '4w' | '8w' | '12w';
	let range: Range = '12w';
	let pmcHoverIdx: number | null = null;

	const RANGES: { key: Range; label: string }[] = [
		{ key: '4w', label: '4W' },
		{ key: '8w', label: '8W' },
		{ key: '12w', label: '12W' }
	];

	$: pmcVisible = (() => {
		const n = range === '4w' ? 28 : range === '8w' ? 56 : 84;
		return series.slice(-Math.min(n, series.length));
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

	function onPmcMove(e: MouseEvent) {
		const target = e.currentTarget as SVGGraphicsElement;
		const css = target.getBoundingClientRect().width || 1;
		const userX = (e.offsetX / css) * PMC_W;
		const chartX = userX - PMC_PAD_L;
		const frac = Math.max(0, Math.min(1, chartX / PMC_INNER_W));
		const i = Math.round(frac * Math.max(0, pmcGeo.n - 1));
		if (pmcHoverIdx !== i) pmcHoverIdx = i;
	}
</script>

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

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
	}
	.pmc-card {
		display: flex;
		flex-direction: column;
		padding: 14px 16px;
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
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
	.tip-row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1.5;
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

	@media (max-width: 639px) {
		.card-head {
			flex-wrap: wrap;
			gap: 8px;
		}
		.card-head-left {
			flex-wrap: wrap;
		}
	}
</style>
