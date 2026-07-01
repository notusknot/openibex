<script lang="ts">
	// A single stat tile for the activity-detail summary bar. The label is a
	// constant (the 8 stats are a fixed set — see activityDetailService), so while
	// the detail streams in we render the real label + a skeleton where the value
	// goes; the card is then the exact height of a populated one (no reflow).
	import Skeleton from './Skeleton.svelte';

	export let label: string;
	export let val: string | number = '';
	export let unit = '';
	export let tip = ''; // native-tooltip explanation, when the stat has one
	export let loading = false;
</script>

<div class="stat-card">
	<div class="stat-label oi-mono" class:has-tip={!!tip} title={tip || null}>{label}</div>
	<div class="stat-val oi-mono">
		{#if loading}
			<Skeleton text="000" radius="4px" />
		{:else}
			{val}{#if unit}<span class="stat-unit"> {unit}</span>{/if}
		{/if}
	</div>
</div>

<style>
	.stat-card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 8px;
		padding: 11px 13px;
		min-width: 0;
	}
	.stat-label {
		font-size: 8px;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Calculated stats (TSS, IF) carry an explanatory native tooltip. */
	.stat-label.has-tip {
		cursor: help;
	}
	.stat-val {
		font-size: 19px;
		font-weight: 600;
		color: var(--ink);
		margin-top: 6px;
		line-height: 1;
	}
	.stat-unit {
		font-size: 10px;
		color: var(--faint);
		font-weight: 500;
	}

	@media (max-width: 639px) {
		.stat-card {
			padding: 9px 11px;
		}
		.stat-val {
			font-size: 16px;
		}
	}
</style>
