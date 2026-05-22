<script lang="ts">
	import { page } from '$app/stores';
</script>

<h1>Something went wrong</h1>
<p class="muted">
	Status: {$page.status}
</p>
<pre class="error">{String($page.error?.message ?? $page.error ?? 'Unknown error')}</pre>
<p>
	<a href="/dashboard">Go to dashboard</a> · <a href="/">Home</a>
</p>

<style>
	.muted {
		color: #64748b;
	}
	.error {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 12px;
		overflow: auto;
	}
</style>

