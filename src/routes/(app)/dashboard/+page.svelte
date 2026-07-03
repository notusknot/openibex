<script lang="ts">
	import type { PageData } from './$types';
	import { theme, setTheme, type Theme } from '$lib/stores/theme';
	import KpiStrip from './KpiStrip.svelte';
	import PmcChart from './PmcChart.svelte';
	import ReadinessCard from './ReadinessCard.svelte';
	import MonotonyStrainCard from './MonotonyStrainCard.svelte';
	import SportSplitCard from './SportSplitCard.svelte';
	import WeeklyVolumeBars from './WeeklyVolumeBars.svelte';
	import TimeInZonesCard from './TimeInZonesCard.svelte';
	import PowerProfileCard from './PowerProfileCard.svelte';
	import RecentActivitiesTable from './RecentActivitiesTable.svelte';

	export let data: PageData;
	$: dashboard = data.dashboard;
	$: units = data.units;

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
			<a class="btn btn-primary" href="/activities/upload">Upload .fit</a>
		</div>
	</header>

	<KpiStrip kpis={dashboard.kpis} indicators={dashboard.indicators} />

	<div class="row-pmc">
		<PmcChart series={dashboard.series} />
		<div class="side-col">
			<ReadinessCard
				readinessVal={dashboard.kpis.readinessVal}
				readinessLabel={dashboard.kpis.readinessLabel}
			/>
			<MonotonyStrainCard monotony={dashboard.kpis.monotony} strain={dashboard.kpis.strain} />
			<SportSplitCard sport={dashboard.sport} />
		</div>
	</div>

	<div class="row-bottom">
		<WeeklyVolumeBars weeks={dashboard.weeks} />
		<TimeInZonesCard zones={dashboard.zones} />
		<PowerProfileCard power={dashboard.power} />
	</div>

	{#if dashboard.recent.length > 0}
		<RecentActivitiesTable recent={dashboard.recent} {units} />
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

	/* Layout grids only — each card component owns its own internals. */
	.row-pmc {
		display: grid;
		grid-template-columns: 1fr 244px;
		gap: 11px;
	}
	.side-col {
		display: flex;
		flex-direction: column;
		gap: 11px;
	}
	.row-bottom {
		display: grid;
		grid-template-columns: 1.5fr 1fr 1fr;
		gap: 11px;
	}

	/* ── Responsive ──────────────────────────────────────────────────────
	   Progressive degradation for the page GRID; per-card responsive rules
	   live in the card components. `.side-col > .card` targets child
	   component roots, hence :global. */

	@media (max-width: 899px) {
		.row-pmc {
			grid-template-columns: minmax(0, 1fr);
		}
		.side-col {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 11px;
		}
		.side-col > :global(.card) {
			flex: 1 1 calc(33% - 8px);
			min-width: 0;
		}
		.row-bottom {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 639px) {
		.side-col {
			flex-direction: column;
		}
		.side-col > :global(.card) {
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
	}
</style>
