<script lang="ts">
	import type { PageData } from './$types';

	export let zones: PageData['dashboard']['zones'];
</script>

<div class="card zones-card">
	<div class="card-title">Time in zone <span class="zones-scope oi-mono">bike &amp; run</span></div>
	{#if zones.length > 0}
		<div class="zones-body">
			{#each zones as z}
				<div>
					<div class="zone-row">
						<span class="zone-name">{z.name}</span>
						<span class="oi-mono zone-pct">{z.pct}%</span>
					</div>
					<div class="zone-track">
						<div class="zone-fill" style="width: {z.w}; background: {z.color}"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="card-empty">No heart-rate data in this period.</div>
	{/if}
</div>

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
	}
	.zones-card {
		display: flex;
		flex-direction: column;
		padding: 13px 15px;
	}
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}
	.zones-scope {
		font-size: 8.5px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--faint);
		margin-left: 5px;
	}
	.card-empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 16px 8px;
		font-size: 10.5px;
		line-height: 1.4;
		color: var(--muted);
	}
	.zones-body {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		flex: 1;
		gap: 8px;
		margin-top: 10px;
	}
	.zone-row {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		font-weight: 600;
		color: var(--ink-soft);
		margin-bottom: 3px;
	}
	.zone-name {
		white-space: nowrap;
	}
	.zone-pct {
		color: var(--faint);
	}
	.zone-track {
		height: 6px;
		background: var(--track);
		border-radius: 3px;
		overflow: hidden;
	}
	.zone-fill {
		height: 100%;
	}
</style>
