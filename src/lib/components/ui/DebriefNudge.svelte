<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';

	export let nudge: { id: string; title: string } | null;

	// Dismissal is per-activity in localStorage — per-device, no schema. Saving
	// the debrief removes the nudge server-side everywhere anyway; a plain
	// dismissal re-appearing on the other device is acceptable.
	// ponytail: per-device dismissal; move to the DB if it ever annoys.
	const key = (id: string) => `oi:debrief-nudge:${id}`;
	let dismissedId: string | null = null;
	function dismiss() {
		if (!nudge) return;
		localStorage.setItem(key(nudge.id), '1');
		dismissedId = nudge.id;
	}

	// Hidden while already on that activity's page — the debrief card is right there.
	$: visible =
		browser &&
		nudge !== null &&
		dismissedId !== nudge.id &&
		!$page.url.pathname.includes(nudge.id) &&
		localStorage.getItem(key(nudge.id)) !== '1';
</script>

{#if visible && nudge}
	<div class="nudge" role="status">
		<span class="nudge-txt">Nice work — how did <strong>{nudge.title}</strong> go?</span>
		<a class="nudge-cta" href="/activities/{nudge.id}" on:click={dismiss}>Log it</a>
		<button type="button" class="nudge-x" aria-label="Dismiss" on:click={dismiss}>×</button>
	</div>
{/if}

<style>
	.nudge {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 20; /* above the mobile bottom tabs (z-index 10) */
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 340px;
		background: var(--card);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 10px 12px;
		box-shadow: 0 6px 24px rgb(0 0 0 / 0.12);
		animation: nudge-in 0.25s ease-out;
	}
	@keyframes nudge-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.nudge {
			animation: none;
		}
	}
	.nudge-txt {
		font-size: 12px;
		color: var(--ink-soft);
		min-width: 0;
	}
	.nudge-txt strong {
		color: var(--ink2);
	}
	.nudge-cta {
		font: 600 12px 'Archivo', system-ui, sans-serif;
		color: #fff;
		background: var(--green);
		border-radius: 7px;
		padding: 6px 12px;
		text-decoration: none;
		white-space: nowrap;
	}
	.nudge-x {
		font-size: 16px;
		line-height: 1;
		color: var(--faint);
		background: none;
		border: none;
		padding: 4px;
		cursor: pointer;
	}

	@media (max-width: 767px) {
		.nudge {
			left: 12px;
			right: 12px;
			max-width: none;
			/* clear the fixed bottom tab bar (60px + safe area) */
			bottom: calc(72px + env(safe-area-inset-bottom, 0px));
		}
		.nudge-txt {
			flex: 1;
		}
	}
</style>
