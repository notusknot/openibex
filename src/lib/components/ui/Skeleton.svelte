<script lang="ts">
	// Placeholder for streaming ({#await}) fallbacks. Two modes:
	//  • box (default): a grey rounded rectangle of the given width/height.
	//  • text: pass `text` — renders that string *transparently* with a skeleton
	//    background, so it occupies the exact line box of the real value it stands
	//    in for (it inherits the parent's font-size + line-height). Drop one inside
	//    the real card/row/cell markup and the skeleton height matches the populated
	//    height exactly — nothing reflows when the data streams in.
	// Shimmer/pulse is gated behind prefers-reduced-motion (same as NavProgress).
	export let width = '100%';
	export let height = '1rem';
	export let radius = '8px';
	export let text = '';
</script>

{#if text}
	<span class="skel skel-text" style="border-radius: {radius};" aria-hidden="true">{text}</span>
{:else}
	<div
		class="skel skel-box"
		style="width: {width}; height: {height}; border-radius: {radius};"
		aria-hidden="true"
	></div>
{/if}

<style>
	.skel {
		background: var(--bg-soft);
	}
	.skel-box {
		border: 1px solid var(--line);
		position: relative;
		overflow: hidden;
	}
	.skel-box::after {
		content: '';
		position: absolute;
		inset: 0;
		transform: translateX(-100%);
		background: linear-gradient(90deg, transparent, rgba(160, 160, 160, 0.14), transparent);
		animation: skel-shimmer 1.3s ease-in-out infinite;
	}
	.skel-text {
		color: transparent;
		animation: skel-pulse 1.3s ease-in-out infinite;
	}
	@media (prefers-reduced-motion: reduce) {
		.skel-box::after,
		.skel-text {
			animation: none;
		}
	}
	@keyframes skel-shimmer {
		100% {
			transform: translateX(100%);
		}
	}
	@keyframes skel-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
</style>
