<script lang="ts">
	import type { PageData } from './$types';
	import { computeBarGeo, BAR_BASE_Y, BAR_INNER_H, BAR_PAD_L, BAR_PAD_T, BAR_VIEW_H, BAR_W } from './chartGeometry';

	export let weeks: PageData['dashboard']['weeks'];

	let barHoverIdx: number | null = null;

	$: bars = computeBarGeo(weeks);
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

	function onBarMove(e: MouseEvent) {
		let el = e.target as HTMLElement | null;
		while (el && (!el.dataset || el.dataset['bi'] == null)) el = el.parentElement;
		if (!el) return;
		const i = Number(el.dataset['bi']);
		if (!Number.isFinite(i)) return;
		if (barHoverIdx !== i) barHoverIdx = i;
	}
</script>

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

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
	}
	.volume-card {
		display: flex;
		flex-direction: column;
		padding: 13px 15px;
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
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
	.bars-wrap {
		position: relative;
		width: 100%;
		flex: 1;
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
	.tip-swim {
		color: #8fc0dd;
	}

	@media (max-width: 639px) {
		.card-head {
			flex-wrap: wrap;
			gap: 8px;
		}
	}
</style>
