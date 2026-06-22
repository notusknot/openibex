<script lang="ts">
	export let title: string;
	export let eyebrow = '';
	export let description = '';
	export let density: 'standard' | 'compact' = 'standard';
</script>

<header class="oi-page-header" class:compact={density === 'compact'}>
	<div class="copy">
		{#if eyebrow}
			<div class="eyebrow">{eyebrow}</div>
		{/if}
		<h1>{title}</h1>
		{#if description}
			<p>{description}</p>
		{/if}
	</div>

	{#if $$slots.actions}
		<div class="actions">
			<slot name="actions" />
		</div>
	{/if}
</header>

<style>
	.oi-page-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--oi-space-4);
		margin-bottom: var(--oi-space-5);
	}

	.oi-page-header.compact {
		margin-bottom: var(--oi-space-3);
	}

	.copy {
		min-width: 0;
	}

	.eyebrow {
		margin-bottom: var(--oi-space-1);
		color: var(--oi-color-text-subtle);
		font-size: var(--oi-font-size-xs);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		color: var(--oi-color-text);
		font-size: var(--oi-font-size-2xl);
		line-height: 1.1;
	}

	p {
		max-width: 68ch;
		margin: var(--oi-space-2) 0 0;
		color: var(--oi-color-text-muted);
		font-size: var(--oi-font-size-sm);
		line-height: 1.45;
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: end;
		gap: var(--oi-space-2);
		flex-wrap: wrap;
	}

	@media (max-width: 720px) {
		.oi-page-header {
			align-items: stretch;
			flex-direction: column;
		}

		.actions {
			justify-content: start;
		}
	}
</style>
