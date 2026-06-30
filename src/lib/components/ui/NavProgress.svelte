<script lang="ts">
	// A thin top progress bar driven by SvelteKit's `navigating` store. Client-side
	// navigation otherwise gives zero feedback — the old page just sits there until
	// the new data arrives, which is the main reason clicking a link *feels* slower
	// than a full reload (where the browser shows its own progress UI). This restores
	// that immediate feedback.
	//
	// It deliberately does nothing for fast navigations: the bar only appears after a
	// short delay, so instant page changes never flash a bar.
	import { navigating } from '$app/stores';
	import { onDestroy } from 'svelte';

	const SHOW_DELAY_MS = 120; // don't flash on near-instant navigations
	const TRICKLE_MS = 200;
	const DONE_FADE_MS = 220;

	let visible = false;
	let progress = 0; // 0..1, drives scaleX

	let showTimer: ReturnType<typeof setTimeout> | null = null;
	let trickleTimer: ReturnType<typeof setInterval> | null = null;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	function clearShowAndTrickle() {
		if (showTimer) clearTimeout(showTimer);
		if (trickleTimer) clearInterval(trickleTimer);
		showTimer = null;
		trickleTimer = null;
	}

	function start() {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		clearShowAndTrickle();
		showTimer = setTimeout(() => {
			visible = true;
			progress = 0.08;
			// Ease toward ~90% and stall there until the navigation resolves.
			trickleTimer = setInterval(() => {
				progress = Math.min(0.9, progress + (0.9 - progress) * 0.12 + 0.01);
			}, TRICKLE_MS);
		}, SHOW_DELAY_MS);
	}

	function done() {
		clearShowAndTrickle();
		if (!visible) {
			progress = 0; // navigation finished before the bar even appeared
			return;
		}
		progress = 1;
		hideTimer = setTimeout(() => {
			visible = false;
			progress = 0;
		}, DONE_FADE_MS);
	}

	// `navigating` is non-null only while a navigation is in flight.
	$: if ($navigating) start();
	else done();

	onDestroy(() => {
		clearShowAndTrickle();
		if (hideTimer) clearTimeout(hideTimer);
	});
</script>

{#if visible}
	<div class="oi-navprogress" aria-hidden="true">
		<div class="bar" class:done={progress === 1} style="transform: scaleX({progress})" />
	</div>
{/if}

<style>
	.oi-navprogress {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		z-index: 1000;
		pointer-events: none;
	}
	.bar {
		height: 100%;
		width: 100%;
		transform-origin: 0 50%;
		background: var(--gold, #e7c24b);
		box-shadow: 0 0 8px var(--gold, #e7c24b);
		transition: transform 200ms ease-out;
	}
	/* The final 90% -> 100% sprint should snap quickly before fading. */
	.bar.done {
		transition: transform 120ms ease-out;
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			transition: none;
		}
	}
</style>
