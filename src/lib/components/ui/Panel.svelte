<script lang="ts">
	export let title = '';
	export let eyebrow = '';
	export let density: 'standard' | 'compact' = 'standard';
	export let tone: 'default' | 'muted' | 'raised' = 'default';
</script>

<section class="oi-panel tone-{tone}" class:compact={density === 'compact'}>
	{#if title || eyebrow || $$slots.actions}
		<div class="header">
			<div class="copy">
				{#if eyebrow}
					<div class="eyebrow">{eyebrow}</div>
				{/if}
				{#if title}
					<h2>{title}</h2>
				{/if}
			</div>
			{#if $$slots.actions}
				<div class="actions">
					<slot name="actions" />
				</div>
			{/if}
		</div>
	{/if}

	<div class="body">
		<slot />
	</div>
</section>

<style>
	.oi-panel {
		border: 1px solid var(--oi-color-border);
		border-radius: var(--oi-radius-lg);
		background: var(--oi-color-surface);
		color: var(--oi-color-text);
	}

	.oi-panel.tone-muted {
		background: var(--oi-color-surface-muted);
	}

	.oi-panel.tone-raised {
		background: var(--oi-color-surface-raised);
		box-shadow: var(--oi-shadow-sm);
	}

	.header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: var(--oi-space-3);
		padding: var(--oi-space-4) var(--oi-space-4) 0;
	}

	.compact .header {
		padding: var(--oi-space-3) var(--oi-space-3) 0;
	}

	.copy {
		min-width: 0;
	}

	.eyebrow {
		color: var(--oi-color-text-subtle);
		font-size: var(--oi-font-size-xs);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	h2 {
		margin: 0;
		font-size: var(--oi-font-size-lg);
		line-height: 1.25;
	}

	.actions {
		display: flex;
		gap: var(--oi-space-2);
		flex-wrap: wrap;
		justify-content: end;
	}

	.body {
		padding: var(--oi-space-4);
	}

	.compact .body {
		padding: var(--oi-space-3);
	}
</style>
