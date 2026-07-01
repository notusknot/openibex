<script lang="ts">
	import type { PageData } from './$types';
	import SummaryCard from '$lib/components/ui/SummaryCard.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { SUMMARY_CARD_META } from '$lib/activities/summaryCards';
	import {
		activeRangeCount,
		filterRows,
		sortRows,
		type FilterKey,
		type Ranges,
		type SortDir,
		type SortKey
	} from '$lib/activities/filterSort';
	import {
		distanceFromMeters,
		distanceLabel,
		distanceUnit,
		formatActivityDate,
		formatDuration,
		hrLabel,
		ifLabel,
		ifPctWidth
	} from '$lib/activities/format';
	import { SPORT_COLOR_VAR, SPORT_TAG } from '$lib/sport';

	// `activities` is null while the list streams in — in that state the summary
	// numbers and table rows render as skeletons *inside the real card/thead/row
	// markup*, so every height, grid column, and static column header matches the
	// populated page exactly (no reflow, no streamed static text). The header +
	// search/filter bar live in the shell (+page.svelte); q/filter/ranges are owned
	// there and passed in. Kept a resolved-prop child so the row enrichment stays a
	// once-per-load $: pass rather than re-running on every keystroke.
	export let activities: Awaited<PageData['activities']> | null;
	export let units: PageData['units'];
	export let q: string;
	export let filter: FilterKey;
	export let ranges: Ranges;

	$: loading = activities === null;
	$: needle = q.trim().toLowerCase();

	type ViewRow = NonNullable<Awaited<PageData['activities']>>['rows'][number] & {
		searchText: string;
		distanceDisplay: number;
	};
	// Enrich once per load (skipped entirely while loading).
	$: rows = activities
		? activities.rows.map(
				(r): ViewRow => ({
					...r,
					searchText: `${r.title} ${r.description ?? ''}`.toLowerCase(),
					distanceDisplay: r.distanceM > 0 ? distanceFromMeters(r.distanceM, units) : 0
				})
			)
		: [];

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
	const SKELETON_ROWS = 9; // placeholder rows shown while loading
	let renderLimit = PAGE_SIZE;

	$: shown = filterRows<ViewRow>(rows, filter, needle, ranges);
	$: sorted = sortRows<ViewRow>(shown, sortKey, sortDir);
	$: visible = sorted.slice(0, renderLimit);

	// Snap the render window back to the top whenever the result set or its order
	// changes, so it never inherits a previously grown window.
	$: filter, needle, ranges, sortKey, sortDir, (renderLimit = PAGE_SIZE);

	$: hasActiveQuery = needle !== '' || filter !== 'all' || activeRangeCount(ranges) > 0;

	// Filter-aware summary, computed over the full filtered set (not the window).
	$: visibleSummary = {
		count: shown.length,
		tss: shown.reduce((acc, r) => acc + r.tss, 0),
		distance: Math.round(shown.reduce((acc, r) => acc + r.distanceDisplay, 0)),
		distanceUnit: activities ? activities.summary.distanceUnit : '',
		hours: Math.round((shown.reduce((acc, r) => acc + r.durationSec, 0) / 3600) * 10) / 10
	};

	function showMore() {
		renderLimit += PAGE_SIZE;
	}

	$: totalCount = activities?.totalCount ?? 0;

	// Zip the static card meta (shared with the calendar's cards) with the
	// filter-reactive values, by index — labels/subs/accents come from the meta so
	// they're identical whether loading or populated.
	$: summaryValues = [
		{ value: visibleSummary.count },
		{ value: visibleSummary.tss },
		{ value: visibleSummary.distance, unit: visibleSummary.distanceUnit },
		{ value: visibleSummary.hours, unit: 'h' }
	];
	$: summaryCards = SUMMARY_CARD_META.map((m, i) => ({ ...m, ...(summaryValues[i] ?? {}) }));
</script>

<div class="summary-strip">
	{#each summaryCards as c}
		<SummaryCard {loading} {...c} />
	{/each}
</div>

<div class="table-wrap">
	<div class="thead">
		{#each HEADERS as h}
			<button
				type="button"
				class="th th-sort oi-mono {h.align === 'right' ? 'right' : ''} {h.extra ?? ''}"
				class:active={sortKey === h.key}
				on:click={() => toggleSort(h.key)}
				disabled={loading}
				aria-label={sortKey === h.key
					? `${h.label}, sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}`
					: `Sort by ${h.label}`}
			>
				<span class="th-label">{h.label}</span>
				<span class="sort-caret">{sortKey === h.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
			</button>
		{/each}
	</div>
	{#if loading}
		{#each Array(SKELETON_ROWS) as _}
			<div class="row" aria-hidden="true">
				<!-- Text cells use text-mode skeletons (exact line box); the title cell
				     drives the row height, matching the real row. The sport pill + IF bar
				     are box skeletons sized to their real (non-text) shapes. -->
				<span class="cell-date oi-mono"><Skeleton text="Mon 0/00" radius="3px" /></span>
				<span class="cell-tag"><Skeleton width="30px" height="15px" radius="3px" /></span>
				<span class="cell-title"><Skeleton text="Activity placeholder title here" radius="3px" /></span>
				<span class="cell-num oi-mono"><Skeleton text="00.0 mi" radius="3px" /></span>
				<span class="cell-num oi-mono"><Skeleton text="0:00" radius="3px" /></span>
				<span class="cell-tss oi-mono"><Skeleton text="00" radius="3px" /></span>
				<span class="cell-num oi-mono"><Skeleton text="0.00" radius="3px" /></span>
				<span class="cell-ifbar"><Skeleton width="44px" height="12px" radius="3px" /></span>
			</div>
		{/each}
	{:else}
		{#each visible as r}
			<a class="row" href="/activities/{r.id}" title={r.title}>
				<span class="cell-date oi-mono">{formatActivityDate(r.startTimeMs)}</span>
				<span class="cell-tag">
					<span class="sport-tag oi-mono" style="background: {SPORT_COLOR_VAR[r.sportLabel]}"
						>{SPORT_TAG[r.sportLabel]}</span
					>
				</span>
				<span class="cell-title">{r.title}</span>
				<span class="cell-num oi-mono">{distanceLabel(r.distanceM, units)} {distanceUnit(units)}</span>
				<span class="cell-num oi-mono">{formatDuration(r.durationSec)}</span>
				<span class="cell-tss oi-mono">{r.tss}</span>
				<span class="cell-num oi-mono">{ifLabel(r.intensityFactor)}</span>
				<span class="cell-ifbar">
					<span class="ifbar-track">
						<span
							class="ifbar-fill"
							style="width: {ifPctWidth(r.intensityFactor)}; background: {SPORT_COLOR_VAR[
								r.sportLabel
							]}"
						></span>
					</span>
					<span class="cell-hr oi-mono">{hrLabel(r.avgHr)}</span>
				</span>
			</a>
		{/each}
		{#if shown.length === 0}
			<div class="empty oi-mono">
				{hasActiveQuery ? 'No activities match your filters.' : 'No activities yet.'}
			</div>
		{/if}
	{/if}
	<div class="tfoot">
		{#if loading}
			<span class="tfoot-count oi-mono"><Skeleton text="Showing 00 of 000" radius="3px" /></span>
		{:else}
			<span class="oi-mono tfoot-count">
				Showing {visible.length} of {shown.length}{shown.length !== totalCount
					? ` · ${totalCount} total`
					: ''}
			</span>
			{#if visible.length < shown.length}
				<button type="button" class="btn btn-small" on:click={showMore}>Show more</button>
			{/if}
		{/if}
	</div>
</div>

<style>
	.summary-strip {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}

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
	.btn-small {
		padding: 6px 12px;
		font-size: 11px;
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
	.th-sort:disabled {
		cursor: default;
	}
	.th-sort.right {
		justify-content: flex-end;
	}
	.th-sort:hover:not(:disabled) {
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
		.summary-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
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
