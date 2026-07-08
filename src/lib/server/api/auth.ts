import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';

import { getEnv } from '$lib/server/env';
import {
	getFirstUser,
	getUserByEmail,
	type DbUser
} from '$lib/server/repositories/usersRepository';
import { toAuthUserPrefs, type AuthUserPrefs } from '$lib/server/services/authService';

export type ApiAuth = { user: DbUser; prefs: AuthUserPrefs };

function unauthorized(message: string): Response {
	return json({ error: message }, { status: 401, headers: { 'www-authenticate': 'Bearer' } });
}

function bearerToken(request: Request): string | null {
	const header = request.headers.get('authorization');
	if (!header) return null;
	const m = /^Bearer\s+(.+)$/i.exec(header.trim());
	return m?.[1] ?? null;
}

// Constant-time compare — same guard as security/password.ts, so a wrong token
// can't be discovered byte-by-byte via response timing.
function tokenMatches(provided: string, expected: string): boolean {
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}

/**
 * Gate a read-only API request. Resolves to the served user + prefs, or a
 * ready-to-return Response on failure:
 *   503 — API disabled (no API_TOKEN configured) or no user exists (fail-closed)
 *   401 — missing / malformed / wrong bearer token
 *
 * ponytail: one shared token → one user. A per-user `api_tokens` table + a
 * token-generation CLI is the upgrade path if multi-user or multi-consumer API
 * access is ever needed.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiAuth | Response> {
	const env = getEnv();
	if (!env.API_TOKEN) {
		return json({ error: 'API disabled: set API_TOKEN to enable it.' }, { status: 503 });
	}

	const provided = bearerToken(request);
	if (!provided) return unauthorized('Missing bearer token.');
	if (!tokenMatches(provided, env.API_TOKEN)) return unauthorized('Invalid bearer token.');

	const user = env.API_USER_EMAIL
		? await getUserByEmail(env.API_USER_EMAIL.trim().toLowerCase())
		: await getFirstUser();
	if (!user) {
		return json(
			{ error: 'No user to serve (register one, or check API_USER_EMAIL).' },
			{ status: 503 }
		);
	}

	return { user, prefs: toAuthUserPrefs(user) };
}

/** Parse a positive-int query param, clamped to [min, max], with a default. */
export function clampQueryInt(raw: string | null, def: number, min: number, max: number): number {
	if (raw === null) return def;
	const n = Number(raw);
	if (!Number.isInteger(n)) return def;
	return Math.min(max, Math.max(min, n));
}
