import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';

import { getEnv } from '$lib/server/env';
import { loginWithEmailPassword, SESSION_COOKIE_NAME } from '$lib/server/services/authService';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/dashboard');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.' });
		}

		try {
			const { session } = await loginWithEmailPassword({ email, password });
			const env = getEnv();
			cookies.set(SESSION_COOKIE_NAME, session.token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: env.NODE_ENV === 'production',
				expires: session.expiresAt
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Login failed.';
			return fail(400, { error: message });
		}

		throw redirect(303, '/dashboard');
	}
};
