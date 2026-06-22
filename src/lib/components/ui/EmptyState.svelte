<script lang="ts">
	export let title: string;
	export let message = '';
	export let density: 'standard' | 'compact' = 'standard';
</script>

<section class="oi-empty-state" class:compact={density === 'compact'}>
	<div>
		<h2>{title}</h2>
		{#if message}
			<p>{message}</p>
		{/if}
	</div>

	{#if $$slots.actions}
		<div class="actions">
			<slot name="actions" />
		</div>
	{/if}
</section>

<style>
	.oi-empty-state {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--oi-space-4);
		border: 1px dashed var(--oi-color-border-strong);
		border-radius: var(--oi-radius-lg);
		background: var(--oi-color-surface-muted);
		padding: var(--oi-space-5);
		color: var(--oi-color-text);
	}

	.oi-empty-state.compact {
		padding: var(--oi-space-4);
	}

	h2 {
		margin: 0;
		font-size: var(--oi-font-size-lg);
		line-height: 1.25;
	}

	p {
		max-width: 62ch;
		margin: var(--oi-space-2) 0 0;
		color: var(--oi-color-text-muted);
		font-size: var(--oi-font-size-sm);
		line-height: 1.45;
	}

	.actions {
		display: flex;
		gap: var(--oi-space-2);
		flex-wrap: wrap;
	}

	@media (max-width: 720px) {
		.oi-empty-state {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
