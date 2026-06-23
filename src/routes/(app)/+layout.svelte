<script lang="ts">
	import AppShell from '$lib/components/ui/AppShell.svelte';
	import type { LayoutData } from './$types';

	export let data: LayoutData;
</script>

<a class="skip" href="#main">Skip to content</a>

<AppShell user={data.user} railSummary={data.railSummary} garminSync={data.garminSync}>
	<slot />
</AppShell>

<style>
	.skip {
		position: absolute;
		left: -999px;
		top: 8px;
		background: var(--card, #fff);
		color: var(--ink, #0f172a);
		border: 1px solid var(--line, #cbd5e1);
		border-radius: 10px;
		padding: 8px 10px;
	}
	.skip:focus {
		left: 8px;
		z-index: 10;
	}
</style>
