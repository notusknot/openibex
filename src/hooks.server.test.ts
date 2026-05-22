import { beforeEach, describe, expect, it } from 'vitest';

import { handle } from './hooks.server';
import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword, SESSION_COOKIE_NAME } from '$lib/server/services/authService';

function makeCookies(initial: Record<string, string> = {}) {
	const jar = new Map<string, string>(Object.entries(initial));
	return {
		get(name: string) {
			return jar.get(name);
		},
		set(name: string, value: string) {
			jar.set(name, value);
		},
		delete(name: string) {
			jar.delete(name);
		}
	};
}

describe('hooks.server', () => {
	beforeEach(() => {
		process.env.OPENIBEX_ENV = 'test';
		process.env.NODE_ENV = 'test';
		process.env.OPEN_REGISTRATION = 'true';
		process.env.SESSION_SECRET = 'test-secret-test-secret';
		process.env.SESSION_TTL_DAYS = '1';
		process.env.OPENIBEX_DATA_DIR = '/tmp/openibex-test';
		process.env.OPENIBEX_UPLOAD_DIR = '/tmp/openibex-test/uploads';
		process.env.OPENIBEX_STREAM_DIR = '/tmp/openibex-test/streams';
		process.env.DATABASE_URL = `file:/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		resetDbForTests();
	});

	it('protected page redirects unauthenticated user', async () => {
		const event: any = {
			url: new URL('http://localhost/dashboard'),
			cookies: makeCookies(),
			locals: {}
		};

		await expect(
			handle({
				event,
				resolve: async () => new Response('ok')
			} as any)
		).rejects.toMatchObject({ status: 303 });
	});

	it('authenticated user can access dashboard', async () => {
		const { session } = await registerWithEmailPassword({
			email: 'a@b.com',
			password: 'password123'
		});

		const event: any = {
			url: new URL('http://localhost/dashboard'),
			cookies: makeCookies({ [SESSION_COOKIE_NAME]: session.token }),
			locals: {}
		};

		const response = await handle({
			event,
			resolve: async () => new Response('ok')
		} as any);

		expect(response.status).toBe(200);
		expect(event.locals.user?.email).toBe('a@b.com');
	});
});
