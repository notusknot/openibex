import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Thin adapter over the unofficial `garmin-connect` library. This is the ONLY
// module that touches it; everything else (syncService, routes) depends on the
// small interface below so the library can be swapped (e.g. for Python `garth`,
// which supports MFA) without touching the orchestration.
//
// The library is loaded lazily via dynamic import so the common page-load path
// never pulls axios + friends into memory — only an actual sync/connect does.
//
// SECURITY: the library can throw errors whose text embeds the username and
// password (it builds a debug URL on some failures). We never propagate raw
// library messages: login throws our own generic errors, and sync-time errors
// are passed through `redactGarminError()` before being logged or stored.

export interface GarminTokens {
	oauth1: { oauth_token: string; oauth_token_secret: string; [k: string]: unknown };
	oauth2: { access_token: string; refresh_token: string; expires_at?: number; [k: string]: unknown };
}

export interface GarminActivityRef {
	activityId: number;
	/** Start time as epoch ms (Garmin `beginTimestamp`). */
	startTimeMs: number;
	activityName: string | null;
}

/** One authenticated session, bound to a single client for a whole sync run so
 * token refreshes accumulate and can be persisted at the end. */
export interface GarminSession {
	listActivities(start: number, limit: number): Promise<GarminActivityRef[]>;
	/** Original FIT bytes for the activity, extracted from Garmin's zip. */
	downloadFitBytes(activityId: number): Promise<Uint8Array>;
	/** Current (possibly refreshed) tokens, to persist after the run. */
	currentTokens(): GarminTokens;
}

export type OpenGarminSession = (tokens: GarminTokens) => Promise<GarminSession>;

/** Wrong email/password (or any login failure we can't classify further). */
export class GarminAuthError extends Error {
	constructor(message = 'Garmin login failed. Check your email and password.') {
		super(message);
		this.name = 'GarminAuthError';
	}
}

/** The account has two-factor auth enabled, which `garmin-connect` can't do. */
export class GarminMfaUnsupportedError extends Error {
	constructor(
		message = 'Your Garmin account has two-factor authentication enabled, which this sync method does not support yet.'
	) {
		super(message);
		this.name = 'GarminMfaUnsupportedError';
	}
}

/** Garmin had no downloadable original FIT for the activity (e.g. manual entry,
 * or a non-FIT upload like GPX/TCX). */
export class GarminNoFitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GarminNoFitError';
	}
}

type GarminConnectCtor = typeof import('garmin-connect').GarminConnect;

async function loadLib(): Promise<GarminConnectCtor> {
	// garmin-connect is CommonJS; depending on the interop the class may be the
	// named export, under .default, or .default.GarminConnect. Handle all three.
	const mod = (await import('garmin-connect')) as Record<string, unknown> & { default?: Record<string, unknown> };
	const ctor = mod.GarminConnect ?? mod.default?.GarminConnect ?? mod.default;
	if (typeof ctor !== 'function') {
		throw new Error('Failed to load the garmin-connect library.');
	}
	return ctor as GarminConnectCtor;
}

/** Authenticate with email + password and return serializable session tokens.
 * The plaintext password is used only here and never persisted. */
export async function login(email: string, password: string): Promise<GarminTokens> {
	const GarminConnect = await loadLib();
	const gc = new GarminConnect({ username: email, password });
	try {
		await gc.login();
		// exportToken is inside the try: if login "succeeded" but produced no
		// tokens, that's still a login failure, not an unexpected error.
		return gc.exportToken() as unknown as GarminTokens;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		// garmin-connect lumps MFA into a generic "Ticket not found or MFA" failure.
		if (/\bMFA\b|two.?factor|ticket not found/i.test(msg)) {
			throw new GarminMfaUnsupportedError();
		}
		// Attach a redacted hint so the caller can log/show why login failed.
		throw new GarminAuthError(`Garmin login failed (${redactGarminError(err)}).`);
	}
}

/** Open an authenticated session from stored tokens (no network until used). */
export const openGarminSession: OpenGarminSession = async (tokens) => {
	const GarminConnect = await loadLib();
	// The constructor throws "Missing credentials" if called with no argument
	// (its default config lookup resolves to undefined). We authenticate via
	// stored tokens, not a password, so pass an empty-but-truthy placeholder.
	const gc = new GarminConnect({ username: '', password: '' });
	gc.loadToken(tokens.oauth1 as never, tokens.oauth2 as never);

	return {
		async listActivities(start, limit) {
			const activities = await gc.getActivities(start, limit);
			return activities.map((a) => ({
				activityId: a.activityId,
				startTimeMs: a.beginTimestamp,
				activityName: a.activityName ?? null
			}));
		},
		async downloadFitBytes(activityId) {
			return downloadFitBytes(gc, activityId);
		},
		currentTokens() {
			return gc.exportToken() as unknown as GarminTokens;
		}
	};
};

// garmin-connect's downloadOriginalActivityData writes `<dir>/<id>.zip` as a
// side effect, so we hand it a throwaway temp dir, read it back, and pull the
// FIT out in memory.
async function downloadFitBytes(
	gc: { downloadOriginalActivityData(a: { activityId: number }, dir: string, type?: string): Promise<void> },
	activityId: number
): Promise<Uint8Array> {
	const tmpDir = path.join(os.tmpdir(), `openibex-garmin-${activityId}-${crypto.randomBytes(4).toString('hex')}`);
	await fs.mkdir(tmpDir, { recursive: true });
	try {
		await gc.downloadOriginalActivityData({ activityId }, tmpDir, 'zip');
		const zipBytes = await fs.readFile(path.join(tmpDir, `${activityId}.zip`));
		return await extractFirstFit(zipBytes, activityId);
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true });
	}
}

async function extractFirstFit(zipBytes: Uint8Array, activityId: number): Promise<Uint8Array> {
	const JSZip = (await import('jszip')).default;
	const zip = await JSZip.loadAsync(zipBytes);
	const fit = Object.values(zip.files).find((f) => !f.dir && /\.fit$/i.test(f.name));
	if (!fit) {
		throw new GarminNoFitError(`No FIT file in Garmin download for activity ${activityId}.`);
	}
	return fit.async('uint8array');
}

/** Strip anything credential-shaped out of an error message before it is logged
 * or stored. Defense-in-depth against the library embedding secrets in errors. */
export function redactGarminError(err: unknown): string {
	let msg = err instanceof Error ? err.message : String(err);
	// Drop querystrings that carry username/password (the library builds these).
	msg = msg.replace(/([?&](?:username|password|email)=)[^&\s]*/gi, '$1[redacted]');
	// Belt-and-suspenders: collapse anything that still looks like a password kv.
	msg = msg.replace(/(password["'\s:=]+)[^\s,&"']+/gi, '$1[redacted]');
	return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}
