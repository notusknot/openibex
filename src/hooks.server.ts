import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from '$lib/server/services/authService';

const PUBLIC_PREFIXES = ['/api/health', '/_app', '/favicon', '/robots.txt'];
const PUBLIC_PATHS = ['/', '/login', '/register', '/logout'];

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
		event.locals.sessionTokenHash = result.tokenHash;
	} else {
		event.locals.user = null;
		event.locals.sessionTokenHash = null;
		if (token) {
			event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
		}
	}

	const pathname = event.url.pathname;
	if (event.locals.user && isAuthPage(pathname)) {
		throw redirect(303, '/dashboard');
	}

	if (!event.locals.user && isProtectedPath(pathname)) {
		throw redirect(303, '/login');
	}

	return resolve(event);
};
