<div class="oi public-root">
	<slot />
</div>

<style>
	.public-root {
		min-height: 100vh;
		min-height: 100svh;
		background: var(--bg);
		color: var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px));
		font-family: 'Archivo', system-ui, sans-serif;
	}
</style>
