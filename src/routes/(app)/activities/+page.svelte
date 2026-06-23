<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;
	$: list = data.activities;

	type FilterKey = 'all' | 'swim' | 'bike' | 'run';
	let filter: FilterKey = 'all';

	const FILTERS: { key: FilterKey; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'swim', label: 'Swim' },
		{ key: 'bike', label: 'Bike' },
		{ key: 'run', label: 'Run' }
	];

	function matchesFilter(sport: string): boolean {
		return filter === 'all' || sport === filter;
	}

	// Filter-aware summary, computed reactively in the browser. The server-side
	// summary is the "all" baseline; this overrides when the user picks a sport.
	$: shown = list.rows.filter((r) => matchesFilter(r.sport));
	$: visibleSummary = {
		count: shown.length,
		tss: shown.reduce((acc, r) => acc + r.tss, 0),
		km: Math.round(shown.reduce((acc, r) => acc + r.distanceKm, 0)),
		hours: Math.round((shown.reduce((acc, r) => acc + r.durationSec, 0) / 3600) * 10) / 10
	};
</script>

<section class="page">
	<header class="head">
		<div>
			<h1 class="title">Activities</h1>
			<p class="subtitle oi-mono">{list.totalCount} records · last {list.shownLimit} shown</p>
		</div>
		<div class="head-actions">
			<span class="pill oi-mono" aria-hidden="true">Last 90 days ▾</span>
			<a class="btn" href="/settings/export">Export CSV</a>
			<a class="btn btn-primary" href="/activities/upload">Upload .fit</a>
		</div>
	</header>

	<div class="summary-strip">
		<div class="summary-card sum-shown">
			<div class="sum-label oi-mono">Shown</div>
			<div class="sum-val oi-mono">{visibleSummary.count}</div>
			<div class="sum-sub oi-mono">activities</div>
		</div>
		<div class="summary-card sum-load">
			<div class="sum-label oi-mono">Load</div>
			<div class="sum-val oi-mono">{visibleSummary.tss}</div>
			<div class="sum-sub oi-mono">total TSS</div>
		</div>
		<div class="summary-card sum-distance">
			<div class="sum-label oi-mono">Distance</div>
			<div class="sum-val oi-mono">
				{visibleSummary.km}<span class="sum-unit"> km</span>
			</div>
			<div class="sum-sub oi-mono">combined</div>
		</div>
		<div class="summary-card sum-time">
			<div class="sum-label oi-mono">Time</div>
			<div class="sum-val oi-mono">
				{visibleSummary.hours}<span class="sum-unit">h</span>
			</div>
			<div class="sum-sub oi-mono">moving time</div>
		</div>
	</div>

	<div class="filter-row">
		<div class="filter-chips">
			{#each FILTERS as f}
				<button
					type="button"
					class="filter-chip"
					class:active={filter === f.key}
					on:click={() => (filter = f.key)}
					aria-pressed={filter === f.key}
				>
					{f.label}
				</button>
			{/each}
		</div>
		<span class="sort-label oi-mono">Sorted by date ▾</span>
	</div>

	<div class="table-wrap">
		<div class="thead">
			<span class="th oi-mono">Date</span>
			<span class="th oi-mono">Sport</span>
			<span class="th oi-mono">Title</span>
			<span class="th oi-mono right">Dist</span>
			<span class="th oi-mono right">Time</span>
			<span class="th oi-mono right">TSS</span>
			<span class="th oi-mono right">IF</span>
			<span class="th oi-mono ifbar-th">IF · Avg HR</span>
		</div>
		{#each list.rows as r}
			<a
				class="row"
				class:dim={!matchesFilter(r.sport)}
				href="/activities/{r.id}"
				title={r.title}
			>
				<span class="cell-date oi-mono">{r.date}</span>
				<span class="cell-tag">
					<span class="sport-tag oi-mono" style="background: {r.color}">{r.tag}</span>
				</span>
				<span class="cell-title">{r.title}</span>
				<span class="cell-num oi-mono">{r.distanceLabel} km</span>
				<span class="cell-num oi-mono">{r.durationLabel}</span>
				<span class="cell-tss oi-mono">{r.tss}</span>
				<span class="cell-num oi-mono">{r.ifLabel}</span>
				<span class="cell-ifbar">
					<span class="ifbar-track">
						<span class="ifbar-fill" style="width: {r.ifPctWidth}; background: {r.color}"></span>
					</span>
					<span class="cell-hr oi-mono">{r.hrLabel}</span>
				</span>
			</a>
		{/each}
		<div class="tfoot">
			<span class="oi-mono tfoot-count">
				Showing {shown.length} of {list.totalCount}
			</span>
			{#if list.totalCount > list.shownLimit}
				<a class="btn btn-small" href="/activities?limit={Math.min(500, list.shownLimit + 50)}">
					Load more
				</a>
			{/if}
		</div>
	</div>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
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
	/* Three top-bar controls (period pill, Export, Upload) share identical
	   padding, font size, weight, line-height, radius — so they line up at
	   the same height instead of looking ragged. Only font-family and
	   color/bg differ to keep visual hierarchy. */
	.pill,
	.btn {
		font-size: 12px;
		font-weight: 600;
		line-height: 1.2;
		border-radius: 8px;
		padding: 9px 13px;
		color: var(--btn-ink);
		background: var(--card);
		border: 1px solid var(--line);
		text-decoration: none;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
	}
	.pill {
		font-family: 'JetBrains Mono', ui-monospace, monospace;
		font-feature-settings: 'tnum' 1;
	}
	.btn {
		font-family: 'Archivo', system-ui, sans-serif;
	}
	.btn-primary {
		color: #fff;
		background: var(--green);
		border-color: transparent;
	}
	.btn-small {
		padding: 6px 12px;
		font-size: 11px;
	}

	.summary-strip {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}
	.summary-card {
		background: var(--card);
		border: 1px solid var(--line);
		border-top: 2px solid var(--green);
		border-radius: 8px;
		padding: 12px 14px;
	}
	.sum-shown {
		border-top-color: var(--green);
	}
	.sum-load {
		border-top-color: var(--c-fat);
	}
	.sum-distance {
		border-top-color: var(--run);
	}
	.sum-time {
		border-top-color: var(--c-form);
	}
	.sum-label {
		font-size: 8.5px;
		letter-spacing: 0.08em;
		color: var(--faint);
		text-transform: uppercase;
	}
	.sum-val {
		font-size: 24px;
		font-weight: 600;
		color: var(--ink);
		margin-top: 6px;
		line-height: 1;
	}
	.sum-unit {
		font-size: 13px;
		color: var(--faint);
		margin-left: 2px;
	}
	.sum-sub {
		font-size: 9.5px;
		color: var(--muted);
		margin-top: 5px;
	}

	.filter-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.filter-chips {
		display: flex;
		gap: 6px;
	}
	.filter-chip {
		font: 600 11px 'Archivo', system-ui, sans-serif;
		padding: 6px 12px;
		border-radius: 999px;
		cursor: pointer;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--btn-ink);
		line-height: 1;
	}
	.filter-chip.active {
		background: var(--green);
		color: #fff;
		border-color: transparent;
	}
	.sort-label {
		font-size: 11px;
		color: var(--faint);
	}

	.table-wrap {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		overflow: hidden;
	}
	.thead,
	.row {
		display: grid;
		/* Right-side numeric columns shrunk to give the title minmax(0,1fr) a
		   meaningfully wider track — activity names were getting truncated
		   prematurely on typical-width viewports. */
		grid-template-columns: 92px 56px minmax(0, 1fr) 64px 58px 48px 44px 100px;
		align-items: center;
		padding: 0 14px;
	}
	.thead {
		border-bottom: 1px solid var(--line);
		background: var(--bg-soft);
	}
	.th {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: var(--muted);
		text-transform: uppercase;
		font-weight: 600;
		padding: 10px 0;
	}
	.th.right {
		text-align: right;
	}
	.th.ifbar-th {
		padding-left: 10px;
	}

	.row {
		border-bottom: 1px solid var(--line);
		text-decoration: none;
		transition: opacity 120ms ease, background 120ms ease;
	}
	.row:hover {
		background: var(--bg-soft);
	}
	.row.dim {
		opacity: 0.32;
	}
	.cell-date {
		font-size: 11px;
		color: var(--ink-soft);
		padding: 11px 0;
	}
	.cell-tag {
		padding: 11px 0;
	}
	.sport-tag {
		font-size: 8.5px;
		font-weight: 600;
		color: #fff;
		border-radius: 3px;
		padding: 2px 6px;
	}
	.cell-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
		padding: 11px 4px 11px 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.cell-num {
		font-size: 11px;
		color: var(--ink-soft);
		padding: 11px 0;
		text-align: right;
	}
	.cell-tss {
		font-size: 12px;
		font-weight: 600;
		color: var(--ink2);
		padding: 11px 0;
		text-align: right;
	}
	.cell-ifbar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 11px 0 11px 10px;
	}
	.ifbar-track {
		flex: 1;
		height: 5px;
		background: var(--track);
		border-radius: 3px;
		overflow: hidden;
	}
	.ifbar-fill {
		display: block;
		height: 100%;
	}
	.cell-hr {
		font-size: 10.5px;
		color: var(--muted);
		width: 30px;
		text-align: right;
	}

	.tfoot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: var(--bg-soft);
	}
	.tfoot-count {
		font-size: 10.5px;
		color: var(--faint);
	}

	/* ── Responsive ───────────────────────────────────────────────────── */

	@media (max-width: 640px) {
		.head {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}
		.head-actions {
			justify-content: space-between;
			flex-wrap: wrap;
		}
		.summary-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.filter-row {
			flex-direction: column;
			align-items: stretch;
			gap: 8px;
		}
		.sort-label {
			display: none;
		}
		.thead,
		.row {
			grid-template-columns: 76px 50px minmax(0, 1fr) 48px;
			padding: 0 12px;
		}
		/* Hide Dist (col 4), Time (col 5), IF (col 7), IF-bar (col 8). Keep
		   Date / Sport / Title / TSS — the essentials for scanning. */
		.thead > :nth-child(4),
		.thead > :nth-child(5),
		.thead > :nth-child(7),
		.thead > :nth-child(8),
		.row > :nth-child(4),
		.row > :nth-child(5),
		.row > :nth-child(7),
		.row > :nth-child(8) {
			display: none;
		}
		.cell-date {
			font-size: 11.5px;
		}
		.tfoot {
			padding: 12px;
		}
	}
</style>
