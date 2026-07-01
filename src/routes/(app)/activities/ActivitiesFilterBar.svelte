<script lang="ts">
	import type { PageData } from './$types';
	import {
		activeRangeCount,
		emptyRanges,
		METRIC_DEFS,
		type FilterKey,
		type Ranges
	} from '$lib/activities/filterSort';
	import { distanceUnit } from '$lib/activities/format';

	// Search + sport/range filters for the activities page. Hoisted out of
	// ActivitiesView so it renders in the always-present page shell (real
	// placeholder + chip text on the first frame) instead of streaming with the
	// data. The page wrapper owns q/filter/ranges (bound here); the streamed
	// ActivitiesView reads the same state to run its pipeline.
	export let q: string;
	export let filter: FilterKey;
	export let ranges: Ranges;
	export let units: PageData['units'];

	const FILTERS: { key: FilterKey; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'swim', label: 'Swim' },
		{ key: 'bike', label: 'Bike' },
		{ key: 'run', label: 'Run' }
	];

	function clearRanges() {
		ranges = emptyRanges();
	}

	// Distance is entered in the user's display unit (km|mi) — available from the
	// sync `units` prop, so the popover needs no loaded data.
	$: metricDefs = METRIC_DEFS.map((m) => ({ ...m, unit: m.unit ?? distanceUnit(units) }));
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
</script>

<svelte:window on:click={onWindowClick} on:keydown={onKeydown} />

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

<style>
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
</style>
