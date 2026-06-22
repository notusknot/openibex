<script lang="ts">
	export let tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' = 'neutral';
	export let label: string;
</script>

<span class="oi-status-badge tone-{tone}">{label}</span>

<style>
	.oi-status-badge {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		min-height: 1.5rem;
		border: 1px solid var(--tone-color, var(--oi-color-border-strong));
		border-radius: var(--oi-radius-pill);
		background: color-mix(in srgb, var(--tone-color, var(--oi-color-border-strong)) 10%, transparent);
		color: var(--tone-color, var(--oi-color-text-muted));
		font-size: var(--oi-font-size-xs);
		font-weight: 700;
		line-height: 1;
		padding: 0 var(--oi-space-2);
		white-space: nowrap;
	}

	.tone-success {
		--tone-color: var(--oi-color-success);
	}

	.tone-warning {
		--tone-color: var(--oi-color-warning);
	}

	.tone-danger {
		--tone-color: var(--oi-color-danger);
	}

	.tone-info {
		--tone-color: var(--oi-color-info);
	}

	.tone-accent {
		--tone-color: var(--oi-color-accent);
	}
</style>
