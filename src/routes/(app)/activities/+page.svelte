<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { emptyRanges, type FilterKey, type Ranges } from '$lib/activities/filterSort';
	import ActivitiesFilterBar from './ActivitiesFilterBar.svelte';
	import ActivitiesView from './ActivitiesView.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { swr, PENDING, FAILED } from '$lib/swrCache';

	export let data: PageData;

	// Search/filter state lives here in the always-rendered shell so the search bar
	// + chips stay put across the load and never flash; ActivitiesView reads the
	// same state to run its pipeline.
	let q = '';
	let filter: FilterKey = 'all';
	let ranges: Ranges = emptyRanges();

	// Stale-while-revalidate: revisiting /activities shows the last-loaded set
	// instantly (ActivitiesView already renders null as its loading state), then the
	// fresh stream swaps in. Filtering/sorting stays client-side over whichever set.
	$: activitiesStore = swr($page.url.pathname, data.activities);
	$: activities = $activitiesStore === PENDING || $activitiesStore === FAILED ? null : $activitiesStore;
</script>

<section class="page">
	<!-- Header + filter bar are static chrome, rendered outside {#await} so they
	     never flash. ActivitiesView renders its own loading state (skeletons inside
	     the real card/thead/row markup) so heights + static column headers match. -->
	<header class="head">
		<div>
			<h1 class="title">Activities</h1>
			<p class="subtitle oi-mono">
				{#if activities}{activities.totalCount} records{:else if $activitiesStore !== FAILED}<Skeleton text="000 records" radius="4px" />{/if}
			</p>
		</div>
		<div class="head-actions">
			<a class="btn" href="/settings/export">Export CSV</a>
			<a class="btn btn-primary" href="/activities/upload">Upload .fit</a>
		</div>
	</header>

	<ActivitiesFilterBar bind:q bind:filter bind:ranges units={data.units} />

	{#if $activitiesStore === FAILED}
		<p class="load-error oi-mono">
			Couldn't load activities. <button type="button" on:click={() => location.reload()}>Retry</button>
		</p>
	{:else}
		<ActivitiesView {activities} units={data.units} {q} {filter} {ranges} />
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	/* ── Static header (moved here from the view so it doesn't stream) ── */
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

	.load-error {
		font-size: 12px;
		color: var(--muted);
		padding: 24px 4px;
	}
	.load-error button {
		background: none;
		border: none;
		color: var(--green);
		cursor: pointer;
		font: inherit;
		text-decoration: underline;
	}

	@media (max-width: 640px) {
		.head-actions {
			flex-direction: column;
			align-items: flex-end;
		}
	}
</style>
