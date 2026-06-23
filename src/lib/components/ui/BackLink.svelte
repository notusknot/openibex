<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';

	/**
	 * Context-aware back chevron. It returns to whatever in-app page you arrived
	 * from (so the activity viewer goes back to the calendar when you came from
	 * the calendar, or to the activities list when you came from there), and
	 * falls back to `fallback` on a direct load / refresh where there is no
	 * previous page to return to.
	 */
	export let fallback: string;
	/** Human label for the fallback destination, used only in the aria-label. */
	export let fallbackLabel = 'back';

	let prev: string | null = null;

	afterNavigate((nav) => {
		const from = nav.from?.url;
		const here = nav.to?.url ?? $page.url;
		// Only honor same-origin, different-page referrers — ignore reloads of
		// the current page and any cross-origin entry point.
		if (from && from.origin === here.origin && from.pathname !== here.pathname) {
			prev = from.pathname + from.search;
		} else {
			prev = null;
		}
	});

	$: href = prev ?? fallback;
</script>

<a class="back" {href} aria-label={prev ? 'Go back' : `Back to ${fallbackLabel}`}>‹</a>

<style>
	.back {
		margin-top: 3px;
		width: 30px;
		height: 30px;
		border-radius: 7px;
		border: 1px solid var(--line);
		background: var(--card);
		color: var(--btn-ink);
		font-size: 15px;
		line-height: 28px;
		text-align: center;
		text-decoration: none;
		flex: none;
	}
	.back:hover {
		color: var(--ink);
	}
</style>
