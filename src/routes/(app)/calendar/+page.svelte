<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { page } from '$app/stores';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import CalendarView from './CalendarView.svelte';
	import { swr, PENDING, FAILED } from '$lib/swrCache';

	export let data: PageData;
	export let form: ActionData;

	// Owned here so the sport filter survives prev/next month navigation — each
	// month switch re-streams data and remounts CalendarView.
	type FilterKey = 'all' | 'swim' | 'bike' | 'run';
	let filter: FilterKey = 'all';

	// Stale-while-revalidate: revisiting a month (incl. prev/next paging back) shows
	// the last-loaded grid instantly, then refetches. Keyed by URL incl. ?month=.
	$: calStore = swr($page.url.pathname + $page.url.search, data.calendar);
	$: calendar = $calStore === PENDING || $calStore === FAILED ? undefined : $calStore;
</script>

{#if $calStore === PENDING}
	<section class="sk-cal" aria-busy="true">
		<Skeleton width="130px" height="26px" />
		<div class="sk-strip">
			{#each Array(4) as _}
				<Skeleton height="64px" radius="10px" />
			{/each}
		</div>
		<Skeleton height="360px" radius="10px" />
	</section>
{:else if $calStore === FAILED}
	<p class="load-error oi-mono">
		Couldn't load the calendar. <button type="button" on:click={() => location.reload()}>Retry</button>
	</p>
{:else if calendar}
	<CalendarView {calendar} {form} bind:filter />
{/if}

<style>
	.sk-cal {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.sk-strip {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
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
		.sk-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
