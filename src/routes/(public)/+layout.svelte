<script lang="ts">
	export let data: { user: { email: string; displayName: string | null } | null };
</script>

<div class="oi public-root">
	<slot />

	{#if data.user}
		<a class="signed-in-pill oi-mono" href="/dashboard">Signed in · {data.user.email}</a>
	{/if}
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
	.signed-in-pill {
		position: fixed;
		top: 16px;
		right: 16px;
		font-size: 11px;
		color: var(--muted);
		text-decoration: none;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 6px 12px;
	}
	.signed-in-pill:hover {
		color: var(--ink);
	}
</style>
