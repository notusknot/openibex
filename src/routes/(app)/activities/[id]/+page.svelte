<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import BackLink from '$lib/components/ui/BackLink.svelte';
	import ActivityDetailView from './ActivityDetailView.svelte';
	import { swr, PENDING, FAILED } from '$lib/swrCache';

	export let data: PageData;

	// Stale-while-revalidate: on revisit, render the last-loaded detail instantly
	// (no skeleton) while the fresh stream resolves in the background. Keyed by URL
	// (unique per activity).
	$: detailStore = swr($page.url.pathname, data.detail);
	$: detail = $detailStore === PENDING || $detailStore === FAILED ? undefined : $detailStore;

	// The summary bar is a fixed set of 8 stats (must match the order built in
	// activityDetailService.summaryStats). The labels are constant, so we render
	// them immediately and skeleton only the values.
	const DETAIL_STAT_LABELS = [
		'Duration',
		'Distance',
		'TSS',
		'IF',
		'Avg pace',
		'Avg HR',
		'Elevation',
		'Calories'
	];
</script>

{#if $detailStore === PENDING}
	<!-- Skeleton mirrors the populated layout inside the real containers: the back
	     link, stat labels, and chart titles render immediately as real text; only the
	     title/date, stat values, and chart plots (genuinely per-activity data) are
	     skeletons, sized from the real geometry so heights match and nothing reflows. -->
	<section class="detail" aria-busy="true">
		<header class="head">
			<div class="head-left">
				<BackLink fallback="/activities" fallbackLabel="activities" />
				<div class="sk-titlewrap">
					<div class="sk-bar sk-title" aria-hidden="true"></div>
					<div class="sk-bar sk-date" aria-hidden="true"></div>
				</div>
			</div>
			<div class="head-actions">
				<Skeleton width="82px" height="30px" radius="7px" />
				<Skeleton width="88px" height="30px" radius="7px" />
				<Skeleton width="62px" height="30px" radius="7px" />
			</div>
		</header>

		<div class="stats-strip">
			{#each DETAIL_STAT_LABELS as label}
				<StatCard {label} loading />
			{/each}
		</div>

		<!-- Chart chrome (card + title text) is static, so it renders as real text;
		     the plot box is sized to the chart's real SVG height (208 / 96) and the
		     head reserves the real toggle/unit row so nothing reflows on load. -->
		<div class="sk-chart">
			<div class="sk-card-head">
				<div class="sk-card-title">HR / pace</div>
				<Skeleton width="150px" height="24px" radius="7px" />
			</div>
			<Skeleton height="208px" radius="6px" />
		</div>
		<div class="sk-chart">
			<div class="sk-card-head">
				<div class="sk-card-title">Elevation</div>
				<Skeleton width="18px" height="10px" radius="3px" />
			</div>
			<Skeleton height="96px" radius="6px" />
		</div>
	</section>
{:else if $detailStore === FAILED}
	<p class="load-error oi-mono">
		Couldn't load this activity. <button type="button" on:click={() => location.reload()}>Retry</button>
	</p>
{:else if detail}
	<ActivityDetailView {detail} />
{:else}
	<section class="notfound">
		<BackLink fallback="/activities" fallbackLabel="activities" />
		<p class="nf-msg oi-mono">Activity not found.</p>
	</section>
{/if}

<style>
	/* Containers mirror ActivityDetailView so the skeleton lays out identically. */
	.detail {
		display: flex;
		flex-direction: column;
		gap: 13px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.head-left {
		display: flex;
		align-items: flex-start;
		gap: 13px;
	}
	.sk-titlewrap {
		display: flex;
		flex-direction: column;
	}
	/* Explicit-height bars, NOT transparent-text pills. The real title has
	   line-height:1, so its line box is exactly font-size (22 / 18px) on every
	   platform; matching that height deterministically avoids the iOS-Safari drift
	   an inline text-background pill produces (which shifted the page on load). */
	.sk-bar {
		background: var(--bg-soft);
		border: 1px solid var(--line);
		animation: sk-bar-pulse 1.3s ease-in-out infinite;
	}
	/* Definite (px) widths, NOT %. A percentage width resolves against the
	   shrink-to-fit .sk-titlewrap and collapses to ~0, which starved .head-left
	   of width so the action buttons stayed on row 1 instead of wrapping like
	   the loaded header does — the whole title/date/actions block then appeared
	   on load and shoved the page down. Fixed widths reserve a realistic
	   one-line title + date so the header wraps identically in both states.
	   Height tracks the real h1's line-box (line-height:1 → font-size): 22px on
	   desktop, but AppShell's `:global(.title){font-size:26px}` mobile bump makes
	   it 26px at ≤767px — see the media query below. */
	.sk-title {
		height: 22px;
		width: 165px;
		border-radius: 5px;
	}
	.sk-date {
		height: 14px;
		width: 195px;
		margin-top: 6px;
		border-radius: 3px;
	}
	@keyframes sk-bar-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sk-bar {
			animation: none;
		}
	}
	.head-actions {
		display: flex;
		gap: 8px;
	}

	.stats-strip {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 1fr));
		gap: 8px;
	}

	.sk-chart {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 8px; /* matches the real chart card-head margin-bottom */
	}
	.sk-card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	/* Mirrors ActivityChart/ElevationChart .card-title so the head height matches. */
	.sk-card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}

	.notfound {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.nf-msg {
		font-size: 13px;
		color: var(--muted);
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

	/* ── Responsive (mirrors ActivityDetailView) ── */
	@media (max-width: 1199px) {
		.stats-strip {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
	/* Matches AppShell's `:global(.title){font-size:26px}` mobile bump (≤767px),
	   which the real h1 obeys — keep this breakpoint/height in sync with it. */
	@media (max-width: 767px) {
		.sk-title {
			height: 26px;
		}
	}
	@media (max-width: 639px) {
		.stats-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 6px;
		}
		.head {
			flex-wrap: wrap;
			gap: 10px;
		}
		.head-actions {
			flex-wrap: wrap;
		}
		.sk-chart {
			padding: 12px 13px; /* matches the real chart card at mobile widths */
		}
	}
</style>
