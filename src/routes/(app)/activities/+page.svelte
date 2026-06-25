<script lang="ts">
	import type { PageData } from './$types';
	import SummaryCard from '$lib/components/ui/SummaryCard.svelte';
	import {
		activeRangeCount,
		emptyRanges,
		filterRows,
		METRIC_DEFS,
		sortRows,
		type FilterKey,
		type Ranges,
		type SortDir,
		type SortKey
	} from '$lib/activities/filterSort';

	export let data: PageData;
	$: list = data.activities;

	type Row = PageData['activities']['rows'][number];

	// ── Sport chips ──────────────────────────────────────────────────────
	let filter: FilterKey = 'all';
	const FILTERS: { key: FilterKey; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'swim', label: 'Swim' },
		{ key: 'bike', label: 'Bike' },
		{ key: 'run', label: 'Run' }
	];

	// ── Text search ──────────────────────────────────────────────────────
	let q = '';
	$: needle = q.trim().toLowerCase();

	// ── Range filters (live in a popover so they don't clutter the page) ──
	let ranges: Ranges = emptyRanges();
	function clearRanges() {
		ranges = emptyRanges();
	}

	// Distance is entered in the user's display unit (km/mi); duration in minutes.
	// METRIC_DEFS owns the keys/order/labels; only the distance unit is dynamic.
	$: metricDefs = METRIC_DEFS.map((m) => ({ ...m, unit: m.unit ?? list.summary.distanceUnit }));

	$: activeFilterCount = activeRangeCount(ranges);

	let filtersOpen = false;
	let filterMenuEl: HTMLElement;
	function onWindowClick(e: MouseEvent) {
		if (filtersOpen && filterMenuEl && !filterMenuEl.contains(e.target as Node)) {
			filtersOpen = false;
		}
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') filtersOpen = false;
	}

	// ── Column sorting ───────────────────────────────────────────────────
	let sortKey: SortKey = 'date';
	let sortDir: SortDir = 'desc';

	const HEADERS: { key: SortKey; label: string; align: 'left' | 'right'; extra?: string }[] = [
		{ key: 'date', label: 'Date', align: 'left' },
		{ key: 'sport', label: 'Sport', align: 'left' },
		{ key: 'title', label: 'Title', align: 'left' },
		{ key: 'distance', label: 'Dist', align: 'right' },
		{ key: 'duration', label: 'Time', align: 'right' },
		{ key: 'tss', label: 'TSS', align: 'right' },
		{ key: 'if', label: 'IF', align: 'right' },
		{ key: 'hr', label: 'Avg HR', align: 'right', extra: 'ifbar-th' }
	];

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'desc' ? 'asc' : 'desc';
		} else {
			sortKey = key;
			sortDir = 'desc'; // first click on a column: high to low
		}
	}

	// ── Pipeline: filter → sort → render window ──────────────────────────
	const PAGE_SIZE = 50;
	let renderLimit = PAGE_SIZE;

	$: shown = filterRows<Row>(list.rows, filter, needle, ranges);
	$: sorted = sortRows<Row>(shown, sortKey, sortDir);
	$: visible = sorted.slice(0, renderLimit);

	// Snap the render window back to the top whenever the result set or its order
	// changes, so it never inherits a previously grown window.
	$: filter, needle, ranges, sortKey, sortDir, (renderLimit = PAGE_SIZE);

	$: hasActiveQuery = needle !== '' || filter !== 'all' || activeFilterCount > 0;

	// Filter-aware summary, computed over the full filtered set (not the window).
	$: visibleSummary = {
		count: shown.length,
		tss: shown.reduce((acc, r) => acc + r.tss, 0),
		distance: Math.round(shown.reduce((acc, r) => acc + r.distanceDisplay, 0)),
		distanceUnit: list.summary.distanceUnit,
		hours: Math.round((shown.reduce((acc, r) => acc + r.durationSec, 0) / 3600) * 10) / 10
	};

	function showMore() {
		renderLimit += PAGE_SIZE;
	}

	$: summaryCards = [
		{ label: 'Shown', value: visibleSummary.count, sub: 'activities', accent: 'var(--green)' },
		{ label: 'Load', value: visibleSummary.tss, sub: 'total TSS', accent: 'var(--c-fat)' },
		{
			label: 'Distance',
			value: visibleSummary.distance,
			unit: visibleSummary.distanceUnit,
			sub: 'combined',
			accent: 'var(--run)'
		},
		{ label: 'Time', value: visibleSummary.hours, unit: 'h', sub: 'moving time', accent: 'var(--c-form)' }
	];
</script>

<svelte:window on:click={onWindowClick} on:keydown={onKeydown} />

<section class="page">
	<header class="head">
		<div>
			<h1 class="title">Activities</h1>
			<p class="subtitle oi-mono">{list.totalCount} records</p>
		</div>
		<div class="head-actions">
			<a class="btn" href="/settings/export">Export CSV</a>
			<a class="btn btn-primary" href="/activities/upload">Upload .fit</a>
		</div>
	</header>

	<div class="summary-strip">
		{#each summaryCards as c}
			<SummaryCard {...c} />
		{/each}
	</div>

	<div class="search-row">
		<svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
			<circle cx="11" cy="11" r="7" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
		<input
			type="search"
			class="search-input oi-mono"
			placeholder="Search activities by title or notes…"
			bind:value={q}
			autocomplete="off"
			spellcheck="false"
			aria-label="Search activities"
		/>
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

		<div class="filter-menu" bind:this={filterMenuEl}>
			<button
				type="button"
				class="filter-toggle"
				class:has-active={activeFilterCount > 0}
				on:click={() => (filtersOpen = !filtersOpen)}
				aria-expanded={filtersOpen}
				aria-haspopup="dialog"
			>
				<svg class="funnel" viewBox="0 0 24 24" aria-hidden="true">
					<polygon points="3 5 21 5 14 13 14 19 10 21 10 13" />
				</svg>
				Filters
				{#if activeFilterCount > 0}<span class="badge oi-mono">{activeFilterCount}</span>{/if}
			</button>

			{#if filtersOpen}
				<div class="filter-pop" role="dialog" aria-label="Range filters">
					<div class="pop-head">
						<span class="pop-title oi-mono">Range filters</span>
						<button
							type="button"
							class="pop-clear"
							on:click={clearRanges}
							disabled={activeFilterCount === 0}
						>
							Clear
						</button>
					</div>
					{#each metricDefs as m}
						<div class="pop-row">
							<span class="pop-label oi-mono">{m.label}</span>
							<input
								class="pop-input oi-mono"
								type="number"
								inputmode="decimal"
								placeholder="min"
								min="0"
								step={m.step}
								bind:value={ranges[m.key].min}
							/>
							<span class="pop-dash">–</span>
							<input
								class="pop-input oi-mono"
								type="number"
								inputmode="decimal"
								placeholder="max"
								min="0"
								step={m.step}
								bind:value={ranges[m.key].max}
							/>
							<span class="pop-unit oi-mono">{m.unit}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="table-wrap">
		<div class="thead">
			{#each HEADERS as h}
				<button
					type="button"
					class="th th-sort oi-mono {h.align === 'right' ? 'right' : ''} {h.extra ?? ''}"
					class:active={sortKey === h.key}
					on:click={() => toggleSort(h.key)}
					aria-label={sortKey === h.key
						? `${h.label}, sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}`
						: `Sort by ${h.label}`}
				>
					<span class="th-label">{h.label}</span>
					<span class="sort-caret">{sortKey === h.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
				</button>
			{/each}
		</div>
		{#each visible as r}
			<a class="row" href="/activities/{r.id}" title={r.title}>
				<span class="cell-date oi-mono">{r.date}</span>
				<span class="cell-tag">
					<span class="sport-tag oi-mono" style="background: {r.color}">{r.tag}</span>
				</span>
				<span class="cell-title">{r.title}</span>
				<span class="cell-num oi-mono">{r.distanceLabel} {r.distanceUnitLabel}</span>
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
		{#if shown.length === 0}
			<div class="empty oi-mono">
				{hasActiveQuery ? 'No activities match your filters.' : 'No activities yet.'}
			</div>
		{/if}
		<div class="tfoot">
			<span class="oi-mono tfoot-count">
				Showing {visible.length} of {shown.length}{shown.length !== list.totalCount
					? ` · ${list.totalCount} total`
					: ''}
			</span>
			{#if visible.length < shown.length}
				<button type="button" class="btn btn-small" on:click={showMore}>Show more</button>
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
	/* The top-bar buttons (Export, Upload) share identical padding, font size,
	   weight, line-height, radius so they line up at the same height instead of
	   looking ragged. */
	.btn {
		font-size: 12px;
		font-weight: 600;
		line-height: 1.2;
		border-radius: 8px;
		padding: 9px 13px;
		margin: 0 0 0 8px;
		color: var(--btn-ink);
		background: var(--card);
		border: 1px solid var(--line);
		text-decoration: none;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
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

	/* Search box: full-width, lines up visually with the table below it. The
	   magnifier sits inside the field so the placeholder reads as search intent. */
	.search-row {
		position: relative;
		display: flex;
		align-items: center;
	}
	.search-icon {
		position: absolute;
		left: 11px;
		width: 13px;
		height: 13px;
		pointer-events: none;
		fill: none;
		stroke: var(--faint);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.search-input {
		flex: 1;
		font-size: 12.5px;
		line-height: 1.2;
		padding: 7px 12px 7px 31px;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--ink);
		outline: none;
	}
	.search-input::placeholder {
		color: var(--faint);
	}
	.search-input:focus {
		border-color: var(--green);
	}

	.filter-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
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

	/* Range filters: a toggle that opens an anchored popover, so the metric
	   inputs stay out of the way until the user wants them. */
	.filter-menu {
		position: relative;
	}
	.filter-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font: 600 11px 'Archivo', system-ui, sans-serif;
		padding: 6px 12px;
		border-radius: 8px;
		cursor: pointer;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--btn-ink);
		line-height: 1;
	}
	.filter-toggle.has-active {
		border-color: var(--green);
		color: var(--green);
	}
	.funnel {
		width: 13px;
		height: 13px;
		fill: currentColor;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 15px;
		height: 15px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--green);
		color: #fff;
		font-size: 9px;
		font-weight: 700;
	}
	.filter-pop {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 30;
		width: min(320px, 86vw);
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.pop-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2px;
	}
	.pop-title {
		font-size: 9px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--faint);
	}
	.pop-clear {
		font: 600 10px 'Archivo', system-ui, sans-serif;
		background: none;
		border: none;
		color: var(--green);
		cursor: pointer;
		padding: 2px 4px;
	}
	.pop-clear:disabled {
		color: var(--faint);
		cursor: default;
	}
	.pop-row {
		display: grid;
		grid-template-columns: 64px 1fr 10px 1fr 30px;
		gap: 6px;
		align-items: center;
	}
	.pop-label {
		font-size: 11px;
		color: var(--ink-soft);
	}
	.pop-input {
		width: 100%;
		min-width: 0;
		font-size: 11px;
		padding: 5px 7px;
		border-radius: 6px;
		border: 1px solid var(--line);
		background: var(--bg-soft);
		color: var(--ink);
		outline: none;
	}
	.pop-input:focus {
		border-color: var(--green);
	}
	/* Drop the native number spinners for a cleaner, denser field. */
	.pop-input::-webkit-outer-spin-button,
	.pop-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.pop-input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.pop-dash {
		text-align: center;
		color: var(--faint);
		font-size: 11px;
	}
	.pop-unit {
		font-size: 10px;
		color: var(--muted);
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
	/* Sortable headers are buttons; strip the chrome and lay out label + caret. */
	.th-sort {
		background: none;
		border: none;
		margin: 0;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 3px;
	}
	.th-sort.right {
		justify-content: flex-end;
	}
	.th-sort:hover {
		color: var(--ink-soft);
	}
	.th-sort.active {
		color: var(--green);
	}
	.sort-caret {
		font-size: 8px;
		line-height: 1;
	}

	.row {
		border-bottom: 1px solid var(--line);
		text-decoration: none;
		transition: background 120ms ease;
	}
	.row:hover {
		background: var(--bg-soft);
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

	.empty {
		padding: 30px 16px;
		text-align: center;
		font-size: 12px;
		color: var(--muted);
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
		/* Keep the title on the left and the actions on the right (desktop row
		   layout); only the actions themselves stack vertically. */
		.head-actions {
			flex-direction: column;
			align-items: flex-end;
		}
		.summary-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		/* Keep the sport chips and the Filters button on one row (the desktop
		   space-between layout), rather than stacking them. */
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
