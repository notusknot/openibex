import crypto from 'node:crypto';
import { getEnv } from '$lib/server/env';
import { hashPassword, verifyPassword } from '$lib/server/security/password';
import { generateSessionToken, hashSessionToken } from '$lib/server/security/sessionToken';
import { countUsers, createUser, getUserByEmail, getUserById, updateDisplayName } from '$lib/server/repositories/usersRepository';
import { createSession, deleteExpiredSessions, deleteSessionByTokenHash, getSessionByTokenHash } from '$lib/server/repositories/sessionsRepository';
import type { Units, UserRole, WeekStart } from '$lib/server/db/schema';

export const SESSION_COOKIE_NAME = 'openibex_session';

export type AuthUser = {
	id: string;
	email: string;
	displayName: string | null;
	role: UserRole;
};

export type AuthUserPrefs = {
	ftpWatts: number | null;
	thresholdHrBpm: number | null;
	maxHrBpm: number | null;
	thresholdPaceSecPerKm: number | null;
	units: Units;
	weekStart: WeekStart;
};

export type AuthSession = {
	token: string;
	expiresAt: Date;
};

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function getSessionSecret(): string {
	const env = getEnv();
	const secret = env.SESSION_SECRET;
	if (secret && secret.length >= 16) return secret;
	if (env.NODE_ENV === 'production') {
		throw new Error('SESSION_SECRET must be set (16+ chars).');
	}
	return 'openibex-dev-secret-openibex-dev-secret';
}

function sessionExpiresAt(): Date {
	const { SESSION_TTL_DAYS } = getEnv();
	return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function registerWithEmailPassword(input: {
	email: string;
	password: string;
	displayName?: string;
}): Promise<{ user: AuthUser; session: AuthSession }> {
	const email = normalizeEmail(input.email);

	const existing = await getUserByEmail(email);
	if (existing) {
		throw new Error('Email is already registered.');
	}

	const totalUsers = await countUsers();
	const env = getEnv();
	if (totalUsers > 0 && !env.OPEN_REGISTRATION) {
		throw new Error('Registration is disabled.');
	}

	const role: UserRole = totalUsers === 0 ? 'admin' : 'athlete';

	const passwordHash = await hashPassword(input.password);
	const userId = crypto.randomUUID();
	const user = await createUser({
		id: userId,
		email,
		passwordHash,
		displayName: input.displayName?.trim() || null,
		role
	});

	const session = await createUserSession(user.id);
	return { user: toAuthUser(user), session };
}

export async function loginWithEmailPassword(input: {
	email: string;
	password: string;
}): Promise<{ user: AuthUser; session: AuthSession }> {
	const email = normalizeEmail(input.email);
	const user = await getUserByEmail(email);
	if (!user) {
		throw new Error('Invalid email or password.');
	}

	const ok = await verifyPassword(input.password, user.passwordHash);
	if (!ok) {
		throw new Error('Invalid email or password.');
	}

	const session = await createUserSession(user.id);
	return { user: toAuthUser(user), session };
}

async function createUserSession(userId: string): Promise<AuthSession> {
	const secret = getSessionSecret();
	const token = generateSessionToken();
	const tokenHash = hashSessionToken(token, secret);
	const expiresAt = sessionExpiresAt();

	await createSession({
		id: crypto.randomUUID(),
		userId,
		sessionTokenHash: tokenHash,
		expiresAt
	});

	return { token, expiresAt };
}

export async function getUserFromSessionToken(token: string): Promise<
	| { user: AuthUser; prefs: AuthUserPrefs; tokenHash: string }
	| null
> {
	if (!token) return null;
	const secret = getSessionSecret();

	await deleteExpiredSessions(new Date());

	const tokenHash = hashSessionToken(token, secret);
	const session = await getSessionByTokenHash(tokenHash);
	if (!session) return null;
	if (session.expiresAt.getTime() <= Date.now()) {
		await deleteSessionByTokenHash(tokenHash);
		return null;
	}

	const user = await getUserById(session.userId);
	if (!user) {
		await deleteSessionByTokenHash(tokenHash);
		return null;
	}

	return { user: toAuthUser(user), prefs: toAuthUserPrefs(user), tokenHash };
}

export async function logoutBySessionToken(token: string): Promise<void> {
	if (!token) return;
	const secret = getSessionSecret();
	const tokenHash = hashSessionToken(token, secret);
	await deleteSessionByTokenHash(tokenHash);
}

export async function updateProfileDisplayName(userId: string, displayName: string): Promise<void> {
	const trimmed = displayName.trim();
	await updateDisplayName(userId, trimmed.length > 0 ? trimmed : null);
}

function toAuthUserPrefs(user: {
	ftpWatts: number | null;
	thresholdHrBpm: number | null;
	maxHrBpm: number | null;
	thresholdPaceSecPerKm: number | null;
	units: Units;
	weekStart: WeekStart;
}): AuthUserPrefs {
	return {
		ftpWatts: user.ftpWatts,
		thresholdHrBpm: user.thresholdHrBpm,
		maxHrBpm: user.maxHrBpm,
		thresholdPaceSecPerKm: user.thresholdPaceSecPerKm,
		units: user.units,
		weekStart: user.weekStart
	};
}

function toAuthUser(user: { id: string; email: string; displayName: string | null; role: UserRole }): AuthUser {
	return {
		id: user.id,
		email: user.email,
		displayName: user.displayName ?? null,
		role: user.role
	};
}
