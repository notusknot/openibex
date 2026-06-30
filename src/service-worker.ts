/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

// OpenIbex PWA service worker.
//
// Goal (chosen deliberately): instant launch, network-first data. We precache
// the app shell — content-hashed JS/CSS chunks (`build`) and public static
// files (`files`) — so a standalone launch paints immediately, but every data
// request goes to the network so authenticated content is never stale.
//
// SAFETY INVARIANT: authenticated HTML (the (app) routes) is NEVER written to
// the cache. The cache only ever holds immutable build chunks, public static
// assets, and the offline fallback page. See ./lib/pwa/strategy.ts for the
// routing decision and its diagram.

import { build, files, version } from '$service-worker';
import { routeStrategy } from './lib/pwa/strategy';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `openibex-cache-${version}`;
const OFFLINE_URL = '/offline.html';

// Everything safe to serve cache-first. `build` = hashed app chunks,
// `files` = static/ (icons, manifest, offline.html). No HTML routes here.
const PRECACHE = [...build, ...files];
const PRECACHED_PATHS = new Set(PRECACHE);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	// Drop caches from previous builds (each build gets a fresh `version`).
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;

	// Only GET is cacheable; let POST/PUT/DELETE (form actions, the API) pass
	// straight through to the network untouched.
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// Never intercept cross-origin requests — the browser handles them.
	if (url.origin !== sw.location.origin) return;

	const strategy = routeStrategy(url, PRECACHED_PATHS);

	if (strategy === 'cache-first') {
		event.respondWith(cacheFirst(request));
		return;
	}

	if (strategy === 'network-only') {
		// /api/* — never cached, no offline fallback.
		event.respondWith(fetch(request));
		return;
	}

	// network-first: navigations + dynamic data. Never cached; the offline
	// shell is served only when a navigation itself fails.
	event.respondWith(networkFirst(request));
});

/** Serve a precached asset from cache, falling back to (and backfilling) the network. */
async function cacheFirst(request: Request): Promise<Response> {
	const cached = await caches.match(request);
	if (cached) return cached;

	// Cache miss (e.g. evicted): fetch and re-store. Safe — these are immutable
	// hashed chunks and public static files only.
	const response = await fetch(request);
	if (response.ok) {
		const cache = await caches.open(CACHE);
		cache.put(request, response.clone());
	}
	return response;
}

/** Always hit the network; on a failed *navigation*, fall back to the offline shell. */
async function networkFirst(request: Request): Promise<Response> {
	try {
		return await fetch(request);
	} catch (error) {
		if (request.mode === 'navigate') {
			const offline = await caches.match(OFFLINE_URL);
			if (offline) return offline;
		}
		throw error;
	}
}
