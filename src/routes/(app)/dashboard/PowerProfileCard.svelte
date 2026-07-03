<script lang="ts">
	import type { PageData } from './$types';

	export let power: PageData['dashboard']['power'];

	$: powerMax = power.length ? Math.max(...power.map((q) => q.val)) : 0;
</script>

<div class="card power-card">
	<div class="card-head-small">
		<div class="card-title">Power profile</div>
		<span class="oi-mono power-period">12 wk · W</span>
	</div>
	{#if power.length > 0}
		<div class="power-body">
			{#each power as p}
				<div class="power-row">
					<span class="oi-mono power-label">{p.label}</span>
					<div class="power-track">
						<div class="power-fill" style="width: {powerMax > 0 ? Math.round((p.val / powerMax) * 100) : 0}%"></div>
					</div>
					<span class="oi-mono power-val">{p.val}</span>
				</div>
			{/each}
		</div>
	{:else}
		<div class="card-empty">No power data — connect a power meter to see your profile.</div>
	{/if}
</div>

<style>
	.card {
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 9px;
	}
	.power-card {
		display: flex;
		flex-direction: column;
		padding: 13px 15px;
	}
	.card-head-small {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 10px;
	}
	.card-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--ink2);
	}
	.power-period {
		font-size: 9px;
		color: var(--faint);
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
	.power-body {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		flex: 1;
		gap: 8px;
	}
	.power-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.power-label {
		font-size: 9.5px;
		color: var(--muted);
		width: 36px;
	}
	.power-track {
		flex: 1;
		height: 7px;
		background: var(--track);
		border-radius: 3px;
		overflow: hidden;
	}
	.power-fill {
		height: 100%;
		background: var(--green);
	}
	.power-val {
		font-size: 10.5px;
		font-weight: 600;
		color: var(--ink);
		width: 36px;
		text-align: right;
	}
</style>
