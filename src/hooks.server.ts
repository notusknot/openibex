import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from '$lib/server/services/authService';
import { registerShutdownHandlers } from '$lib/server/shutdown';

// Runs once when the server module loads: drain in-flight writes + checkpoint
// the WAL + close the DB cleanly on SIGTERM/SIGINT (Docker deploy/restart).
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
	return response;
};
