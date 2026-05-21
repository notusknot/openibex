<script lang="ts">
	const title = 'OpenIbex';
	const tagline = 'A self-hosted training platform for endurance athletes.';
</script>

<div class="app">
	<header class="header">
		<div class="brand">
			<div class="title">{title}</div>
			<div class="tagline">{tagline}</div>
		</div>
		<nav class="nav">
			<a href="/">Home</a>
			<a href="/api/health">Health</a>
		</nav>
	</header>

	<main class="main">
		<slot />
	</main>
</div>

<style>
	:global(html) {
		font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif;
		color: #0f172a;
		background: #f8fafc;
	}

	:global(a) {
		color: inherit;
	}

	.app {
		min-height: 100vh;
		display: grid;
		grid-template-rows: auto 1fr;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid #e2e8f0;
		background: white;
	}

	.brand .title {
		font-weight: 700;
	}

	.brand .tagline {
		font-size: 0.9rem;
		color: #475569;
	}

	.nav {
		display: flex;
		gap: 12px;
		font-size: 0.95rem;
	}

	.main {
		padding: 24px 20px;
		max-width: 960px;
		width: 100%;
		margin: 0 auto;
	}
</style>
