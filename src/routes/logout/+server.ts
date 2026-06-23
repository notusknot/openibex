import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';

import { logoutBySessionToken, SESSION_COOKIE_NAME, sessionCookieSecure } from '$lib/server/services/authService';

export const GET: RequestHandler = async () => {
	throw redirect(303, '/login');
};

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE_NAME) ?? '';
	await logoutBySessionToken(token);
	cookies.delete(SESSION_COOKIE_NAME, {
		path: '/',
		secure: sessionCookieSecure()
	});
	throw redirect(303, '/login');
};

