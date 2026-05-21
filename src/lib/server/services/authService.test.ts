import { beforeEach, describe, expect, it } from 'vitest';

import { resetDbForTests } from '$lib/server/db/client';
import { getDb } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

import { registerWithEmailPassword, loginWithEmailPassword, logoutBySessionToken, getUserFromSessionToken } from '$lib/server/services/authService';
import { hashSessionToken } from '$lib/server/security/sessionToken';
import { getSessionByTokenHash } from '$lib/server/repositories/sessionsRepository';
import { updateProfileDisplayName } from '$lib/server/services/authService';

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
}

describe('authService', () => {
	beforeEach(() => {
		const dbPath = `/tmp/openibex-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`;
		setTestEnv(dbPath);
		resetDbForTests();
	});

	it('registration succeeds', async () => {
		const { user, session } = await registerWithEmailPassword({
			email: 'test@example.com',
			password: 'password123',
			displayName: 'Tester'
		});
		expect(user.email).toBe('test@example.com');
		expect(user.role).toBe('admin');
		expect(session.token.length).toBeGreaterThan(10);

		const db = getDb();
		const dbUser = db.select().from(users).where(eq(users.id, user.id)).get();
		expect(dbUser?.email).toBe('test@example.com');
	});

	it('duplicate email registration fails', async () => {
		await registerWithEmailPassword({ email: 'dup@example.com', password: 'password123' });
		await expect(
			registerWithEmailPassword({ email: 'dup@example.com', password: 'password123' })
		).rejects.toThrow(/already registered/i);
	});

	it('login succeeds with correct password', async () => {
		await registerWithEmailPassword({ email: 'login@example.com', password: 'password123' });
		const { user } = await loginWithEmailPassword({ email: 'login@example.com', password: 'password123' });
		expect(user.email).toBe('login@example.com');
	});

	it('login fails with wrong password', async () => {
		await registerWithEmailPassword({ email: 'wrong@example.com', password: 'password123' });
		await expect(
			loginWithEmailPassword({ email: 'wrong@example.com', password: 'nope-nope-nope' })
		).rejects.toThrow(/invalid email or password/i);
	});

	it('logout invalidates the session', async () => {
		const { session } = await registerWithEmailPassword({ email: 'out@example.com', password: 'password123' });
		const secret = process.env.SESSION_SECRET!;
		const tokenHash = hashSessionToken(session.token, secret);
		expect(await getSessionByTokenHash(tokenHash)).toBeTruthy();

		await logoutBySessionToken(session.token);
		expect(await getSessionByTokenHash(tokenHash)).toBeFalsy();
	});

	it('profile display name update works', async () => {
		const { user } = await registerWithEmailPassword({ email: 'name@example.com', password: 'password123' });
		await updateProfileDisplayName(user.id, 'New Name');

		const db = getDb();
		const updated = db.select().from(users).where(eq(users.id, user.id)).get();
		expect(updated?.displayName).toBe('New Name');
	});

	it('getUserFromSessionToken returns user when valid', async () => {
		const { session, user } = await registerWithEmailPassword({ email: 'sess@example.com', password: 'password123' });
		const got = await getUserFromSessionToken(session.token);
		expect(got?.user.id).toBe(user.id);
	});
});
