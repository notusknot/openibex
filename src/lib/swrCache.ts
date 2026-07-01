import { browser } from '$app/environment';
import { writable, type Readable } from 'svelte/store';

// Stale-while-revalidate cache for streamed page loads — CLIENT-ONLY.
//
// SvelteKit re-runs `load` on every navigation and caches nothing, so revisiting
// a streamed page ({#await}) re-shows its skeleton each time. This keeps the last
// resolved value per page (keyed by URL) in a module-level Map — which survives
// client navigations but resets on a full reload — so a revisit renders instantly
// and silently refetches to update.
//
// Never runs on the server: the `browser` guard means the shared Node process
// never populates the Map, so there's no cross-user leak (the only copy of a
// user's data lives in their own browser's memory, same as SvelteKit's own
// `data`). Correctness rests on the always-on background refetch; `bustSwrCache()`
// (called after mutations, see AppShell) just avoids a one-frame stale flash.
//
// ponytail: unbounded Map — a session visiting thousands of distinct pages would
// grow it; add an LRU cap only if that ever actually shows up.
const cache = new Map<string, unknown>();

export const PENDING = Symbol('pending');
export const FAILED = Symbol('failed');

export function bustSwrCache(): void {
	cache.clear();
}

// Emits the cached value immediately (or PENDING on a cold key), then the fresh
// value once `promise` resolves — caching it. A failed refetch keeps showing
// stale data if we have any, and only surfaces FAILED on a cold key.
export function swr<T>(
	key: string,
	promise: Promise<T>
): Readable<T | typeof PENDING | typeof FAILED> {
	const cached: T | typeof PENDING = browser && cache.has(key) ? (cache.get(key) as T) : PENDING;
	const store = writable<T | typeof PENDING | typeof FAILED>(cached);
	promise.then(
		(value) => {
			if (browser) cache.set(key, value);
			store.set(value);
		},
		() => {
			if (cached === PENDING) store.set(FAILED);
		}
	);
	return store;
}
