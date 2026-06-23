<script lang="ts">
	import '$lib/styles/tokens.css';
</script>

<slot />

<style>
	:global(html, body) {
		margin: 0;
		height: 100%;
	}
	:global(body) {
		font-family: 'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, sans-serif;
		color: var(--oi-color-text, #101827);
		background: var(--oi-color-bg, #f6f8fb);
	}
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}
	:global(a) {
		color: inherit;
	}
	:global(:focus-visible) {
		outline: 2px solid var(--oi-color-brand, #1f6feb);
		outline-offset: 2px;
	}
</style>
