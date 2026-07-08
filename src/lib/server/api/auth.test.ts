import { beforeEach, describe, expect, it } from 'vitest';

import { resetDbForTests } from '$lib/server/db/client';
import { registerWithEmailPassword } from '$lib/server/services/authService';
import { authenticateApiRequest, clampQueryInt, type ApiAuth } from '$lib/server/api/auth';

function setTestEnv(dbPath: string) {
	process.env.OPENIBEX_ENV = 'test';
	process.env.NODE_ENV = 'test';
	process.env.OPEN_REGISTRATION = 'false';
	process.env.SESSION_SECRET = 'test-secret-test-secret';
	process.env.SESSION_TTL_DAYS = '1';
	process.env.OPENIBEX_DATA_DIR = '/tmp/openibex-test';
	process.env.OPENIBEX_UPLOAD_DIR = '/tmp/openibex-test/uploads';
	process.env.OPENIBEX_STREAM_DIR = '/tmp/openibex-test/streams';
	process.env.DATABASE_URL = `file:${dbPath}`;
	delete process.env.API_TOKEN;
	delete process.env.API_USER_EMAIL;
}

const req = (headers: Record<string, string> = {}) =>
	new Request('http://localhost/api/v1/summary', { headers });

describe('authenticateApiRequest', () => {
	beforeEach(() => {
		const dbPath = `/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		setTestEnv(dbPath);
		resetDbForTests();
	});

	it('is disabled (503) when API_TOKEN is unset — fail closed', async () => {
		const res = await authenticateApiRequest(req({ authorization: 'Bearer anything' }));
		expect(res).toBeInstanceOf(Response);
		expect((res as Response).status).toBe(503);
	});

	it('rejects a missing bearer token (401)', async () => {
		process.env.API_TOKEN = 'secret-token';
		const res = await authenticateApiRequest(req());
		expect((res as Response).status).toBe(401);
	});

	it('rejects a wrong bearer token (401)', async () => {
		process.env.API_TOKEN = 'secret-token';
		const res = await authenticateApiRequest(req({ authorization: 'Bearer wrong' }));
		expect((res as Response).status).toBe(401);
	});

	it('is 503 when the token is valid but no user exists', async () => {
		process.env.API_TOKEN = 'secret-token';
		const res = await authenticateApiRequest(req({ authorization: 'Bearer secret-token' }));
		expect((res as Response).status).toBe(503);
	});

	it('resolves the first user on a valid token', async () => {
		process.env.API_TOKEN = 'secret-token';
		const { user } = await registerWithEmailPassword({
			email: 'a@example.com',
			password: 'password123'
		});
		const res = await authenticateApiRequest(req({ authorization: 'Bearer secret-token' }));
		expect(res).not.toBeInstanceOf(Response);
		expect((res as ApiAuth).user.id).toBe(user.id);
		expect((res as ApiAuth).user.email).toBe('a@example.com');
	});

	it('resolves the API_USER_EMAIL user when set', async () => {
		process.env.API_TOKEN = 'secret-token';
		process.env.OPEN_REGISTRATION = 'true';
		await registerWithEmailPassword({ email: 'first@example.com', password: 'password123' });
		const { user: second } = await registerWithEmailPassword({
			email: 'second@example.com',
			password: 'password123'
		});
		process.env.API_USER_EMAIL = 'SECOND@example.com'; // case-insensitive
		const res = await authenticateApiRequest(req({ authorization: 'Bearer secret-token' }));
		expect((res as ApiAuth).user.id).toBe(second.id);
	});
});

describe('clampQueryInt', () => {
	it('defaults, clamps, and rejects non-integers', () => {
		expect(clampQueryInt(null, 20, 1, 100)).toBe(20);
		expect(clampQueryInt('5', 20, 1, 100)).toBe(5);
		expect(clampQueryInt('999', 20, 1, 100)).toBe(100);
		expect(clampQueryInt('0', 20, 1, 100)).toBe(1);
		expect(clampQueryInt('abc', 20, 1, 100)).toBe(20);
	});
});
