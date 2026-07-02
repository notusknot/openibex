<script lang="ts">
	import type { PageData } from './$types';
	import {
		distanceLabel,
		distanceUnit,
		formatActivityDate,
		formatDuration
	} from '$lib/activities/format';
	import { SPORT_COLOR_VAR, SPORT_TAG } from '$lib/sport';

	export let recent: PageData['dashboard']['recent'];
	export let units: PageData['units'];
</script>

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
		{#each recent as r}
			<a class="recent-row" href="/activities/{r.id}" title={r.title}>
				<span class="recent-cell oi-mono recent-date">{formatActivityDate(r.startTimeMs)}</span>
				<span class="recent-cell">
					<span class="recent-tag oi-mono" style="background: {SPORT_COLOR_VAR[r.sportLabel]}"
						>{SPORT_TAG[r.sportLabel]}</span
					>
				</span>
				<span class="recent-cell recent-title">{r.title}</span>
				<span class="recent-cell oi-mono right"
					>{distanceLabel(r.distanceM, units)} {distanceUnit(units)}</span
				>
				<span class="recent-cell oi-mono right">{formatDuration(r.durationSec)}</span>
				<span class="recent-cell oi-mono right recent-tss">{r.tss}</span>
			</a>
		{/each}
	</div>
</div>

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
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
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
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

	@media (max-width: 639px) {
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
</style>
