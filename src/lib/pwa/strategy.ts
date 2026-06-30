// Service-worker fetch routing. Kept as a pure, dependency-free module so the
// classification can be unit-tested without a ServiceWorkerGlobalScope.
//
// The one invariant that makes "network-first for data" safe:
// authenticated HTML (every (app) route — /dashboard, /activities, …) is NEVER
// cached. The only things ever served from cache are content-hashed build
// chunks and public static files, which are listed in the precache set at build
// time. So the strategy below can only return `cache-first` for a path that is
// explicitly in that set; everything else goes to the network.
//
//                       incoming GET (same-origin)
//                                  │
//                 ┌────────────────┴────────────────┐
//                 │   pathname in the precache set?  │
//                 └────────────────┬────────────────┘
//                   yes │                    │ no
//                       ▼                    ▼
//                 'cache-first'   ┌──────────────────────────┐
//                 (hashed asset   │   pathname under /api/ ?  │
//                  or static)     └────────────┬─────────────┘
//                                   yes │              │ no
//                                       ▼              ▼
//                                 'network-only'  'network-first'
//                                 (never cached)  (navigations + dynamic data;
//                                                  offline.html only on a failed
//                                                  navigation; never cached)

export type FetchStrategy = 'cache-first' | 'network-only' | 'network-first';

/**
 * Decide how the service worker should handle a same-origin GET request.
 *
 * @param url            the request URL (caller has already confirmed same-origin + GET)
 * @param precachedPaths pathnames of every precached asset ([...build, ...files])
 */
export function routeStrategy(url: URL, precachedPaths: ReadonlySet<string>): FetchStrategy {
	if (precachedPaths.has(url.pathname)) return 'cache-first';
	if (url.pathname.startsWith('/api/')) return 'network-only';
	return 'network-first';
}
