<script lang="ts">
	import type { PageData } from './$types';
	import { STAT_TIPS } from './statTips';

	export let kpis: PageData['dashboard']['kpis'];
	export let indicators: PageData['dashboard']['indicators'];

	$: kpiCards = [
		{ label: 'Fitness', val: String(kpis.fitness), sub: `CTL · ramp ${kpis.ramp}`, accent: 'var(--c-fit)', tip: STAT_TIPS.fitness, ind: indicators.fitness },
		{ label: 'Fatigue', val: String(kpis.fatigue), sub: 'ATL · 7-day', accent: 'var(--c-fat)', tip: STAT_TIPS.fatigue, ind: indicators.fatigue },
		{ label: 'Form', val: kpis.form, sub: `TSB · ${kpis.readinessLabel}`, accent: 'var(--c-form)', tip: STAT_TIPS.form, ind: indicators.form },
		{ label: 'Week TSS', val: String(kpis.weekTss), sub: 'swim/bike/run', accent: 'var(--swim)', tip: STAT_TIPS.weekTss, ind: indicators.weekTss },
		{ label: 'Readiness', val: String(kpis.readinessVal), sub: kpis.readinessLabel, accent: 'var(--green)', tip: STAT_TIPS.readiness, ind: indicators.readiness },
		{ label: 'Monotony', val: kpis.monotony, sub: `strain ${kpis.strain}`, accent: 'var(--bike)', tip: STAT_TIPS.monotony, ind: indicators.monotony }
	];
</script>

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

<style>
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
		/* Stat labels carry an explanatory native tooltip — hint it with the cursor. */
		cursor: help;
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

	@media (max-width: 1199px) {
		.kpi-strip {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 639px) {
		.kpi-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
