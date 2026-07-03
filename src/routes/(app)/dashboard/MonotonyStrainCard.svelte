<script lang="ts">
	import type { PageData } from './$types';
	import { STAT_TIPS } from './statTips';

	export let monotony: PageData['dashboard']['kpis']['monotony'];
	export let strain: PageData['dashboard']['kpis']['strain'];
</script>

<div class="card split-card">
	<div class="split-cell">
		<div class="split-label oi-mono" title={STAT_TIPS.monotony}>Monotony</div>
		<div class="split-val oi-mono">{monotony}</div>
	</div>
	<div class="split-divider"></div>
	<div class="split-cell">
		<div class="split-label oi-mono" title={STAT_TIPS.strain}>Strain</div>
		<div class="split-val oi-mono">{strain}</div>
	</div>
</div>

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
	}
	.split-card {
		display: flex;
		gap: 10px;
		padding: 12px 14px;
	}
	.split-cell {
		flex: 1;
	}
	.split-label {
		font-size: 8.5px;
		letter-spacing: 0.06em;
		color: var(--faint);
		text-transform: uppercase;
		cursor: help;
	}
	.split-val {
		font-size: 20px;
		font-weight: 600;
		color: var(--ink);
		margin-top: 5px;
	}
	.split-divider {
		width: 1px;
		background: var(--line);
	}
</style>
