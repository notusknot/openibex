import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { getUserFromSessionToken, SESSION_COOKIE_NAME, startSessionSweep } from '$lib/server/services/authService';
import { registerShutdownHandlers } from '$lib/server/shutdown';
import { validateConfigOrThrow } from '$lib/server/env';
import { warnIfSyncKeyMisconfigured } from '$lib/server/sync/keyCheck';
import { failOrphanedImportBatches } from '$lib/server/repositories/importBatchesRepository';
import { getLogger } from '$lib/server/logger';

// Runs once when the server module loads. Fail fast on missing/invalid config,
// then install handlers that drain in-flight writes + checkpoint the WAL + close
// the DB cleanly on SIGTERM/SIGINT (Docker deploy/restart). Skipped under vitest
// (the test runner imports this module before any per-test env is set up).
if (!process.env.VITEST) {
	validateConfigOrThrow();
	// Recover any bulk import left mid-flight by a crash/restart (no background
	// worker — the import rides its originating process), so the UI never shows a
	// perpetual "processing".
	try {
		const swept = failOrphanedImportBatches();
		if (swept > 0) getLogger().warn({ swept }, 'boot: marked interrupted import batches failed');
	} catch (err) {
		getLogger().error({ err }, 'boot: import-batch sweep failed');
	}
	// Periodically GC expired sessions off the request path (was a per-request
	// full DELETE). Timer is unref'd so it never delays shutdown.
	startSessionSweep();
	// Loud (but non-fatal) warning if stored Garmin credentials can't be
	// decrypted with the current SYNC_ENCRYPTION_KEY. Fire-and-forget so it
	// never delays boot; experimental sync must not gate the whole app.
	void warnIfSyncKeyMisconfigured();
}
registerShutdownHandlers();

const PUBLIC_PREFIXES = [
	'/api/health',
	'/_app',
	'/favicon',
	'/robots.txt',
	// Vite dev client assets
	'/@vite',
	'/@id',
	'/__vite_ping'
];
const PUBLIC_PATHS = ['/login', '/register', '/logout'];

function isPublicPath(pathname: string): boolean {
	if (PUBLIC_PATHS.includes(pathname)) return true;
	return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthPage(pathname: string): boolean {
	return pathname === '/login' || pathname === '/register';
}

function isProtectedPath(pathname: string): boolean {
	if (isPublicPath(pathname)) return false;
	// Everything else is considered part of the app in Milestone 1.
	return true;
}

// adapter-node ships no response compression and is typically reached directly
// (Tailscale serve doesn't gzip), so SSR HTML and __data.json go over the wire
// uncompressed — e.g. the activities page data is ~54 KB raw, ~7 KB gzipped, a
// real cost on a phone over Tailscale. Static assets are handled by adapter's
// `precompress` (served by sirv before this hook); this covers the *dynamic*
// text responses sirv never sees. Only GET 200s with a compressible text type
// and a body past one TCP segment are touched.
//
// NOTE: this buffers the full body, so it must not be used with streamed
// responses (un-awaited promises from a `load`). The app awaits all loads today;
// revisit this if SvelteKit streaming is introduced.
const COMPRESSIBLE = /^(?:text\/|application\/(?:json|javascript|xml|.*\+json|.*\+xml)|image\/svg\+xml)/i;
const MIN_COMPRESS_BYTES = 1400;

async function maybeCompress(request: Request, response: Response): Promise<Response> {
	if (request.method !== 'GET' || response.status !== 200) return response;
	if (response.headers.has('content-encoding')) return response;
	if (!COMPRESSIBLE.test(response.headers.get('content-type') ?? '')) return response;

	const accept = request.headers.get('accept-encoding') ?? '';
	const useBr = /\bbr\b/.test(accept);
	const useGzip = /\bgzip\b/.test(accept);
	if (!useBr && !useGzip) return response;

	const body = Buffer.from(await response.arrayBuffer());
	const headers = new Headers(response.headers);
	// Below ~one TCP segment, compression overhead isn't worth it — re-send raw
	// (the body was already consumed, so rebuild the response from the buffer).
	if (body.byteLength < MIN_COMPRESS_BYTES) {
		return new Response(body, { status: response.status, statusText: response.statusText, headers });
	}

	const compressed = useBr
		? brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } })
		: gzipSync(body);
	headers.set('content-encoding', useBr ? 'br' : 'gzip');
	headers.set('content-length', String(compressed.byteLength));
	const vary = headers.get('vary');
	if (!vary) headers.set('vary', 'Accept-Encoding');
	else if (!/\baccept-encoding\b/i.test(vary)) headers.set('vary', `${vary}, Accept-Encoding`);
	return new Response(compressed, { status: response.status, statusText: response.statusText, headers });
}

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE_NAME) ?? '';
	const result = await getUserFromSessionToken(token);
	if (result) {
		event.locals.user = result.user;
		event.locals.userPrefs = result.prefs;
		event.locals.sessionTokenHash = result.tokenHash;
	} else {
		event.locals.user = null;
		event.locals.userPrefs = null;
		event.locals.sessionTokenHash = null;
		if (token) {
			event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
		}
	}

	const pathname = event.url.pathname;
	// The root path is the app home: send signed-in users to the dashboard,
	// everyone else to login. There is no separate landing page.
	if (pathname === '/') {
		throw redirect(303, event.locals.user ? '/dashboard' : '/login');
	}

	if (event.locals.user && isAuthPage(pathname)) {
		throw redirect(303, '/dashboard');
	}

	if (!event.locals.user && isProtectedPath(pathname)) {
		throw redirect(303, '/login');
	}

	const response = await resolve(event);
	// Basic hardening headers (safe defaults for a self-hosted app).
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'same-origin');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('permissions-policy', 'geolocation=(), microphone=(), camera=()');
	return maybeCompress(event.request, response);
};
