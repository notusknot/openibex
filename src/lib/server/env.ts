// Load .env into process.env once, here at the env gate. In the Nix devshell
// and in docker (`env_file`) the core vars are already exported, so dotenv does
// NOT override them — it only fills in vars that live solely in .env (e.g.
// SYNC_ENCRYPTION_KEY). Missing .env file is a silent no-op (fine in the
// container, which doesn't ship one). Mirrors drizzle.config.ts.
import 'dotenv/config';
import path from 'node:path';

export type OpenIbexEnv = {
	DATABASE_URL: string;
	OPENIBEX_DATA_DIR: string;
	OPENIBEX_UPLOAD_DIR: string;
	OPENIBEX_STREAM_DIR: string;
	OPENIBEX_EXPORT_DIR: string;
	OPENIBEX_IMPORT_DIR: string;
	OPENIBEX_ENV: string;
	NODE_ENV: string;
	OPEN_REGISTRATION: boolean;
	SESSION_SECRET?: string;
	SESSION_TTL_DAYS: number;
	// Canonical external origin (also used by adapter-node's CSRF check). Its
	// protocol decides whether session cookies are marked Secure.
	ORIGIN?: string;
	// Experimental Garmin sync: base64-encoded 32-byte key used to encrypt
	// stored provider session tokens (AES-256-GCM). Optional unless a sync
	// credential exists; src/lib/server/sync/crypto.ts throws a clear error
	// if it's needed but missing/malformed.
	SYNC_ENCRYPTION_KEY?: string;
	// pino log level: fatal|error|warn|info|debug|trace|silent (default info).
	LOG_LEVEL: string;
	// Experimental calendar (ICS) subscription sync. All optional with sane
	// defaults; tune only if a feed misbehaves. There is no background worker —
	// polling is opportunistic on page loads, throttled per subscription.
	CALENDAR_SYNC_THROTTLE_MS: number; // min gap between auto-polls of one feed
	CALENDAR_SYNC_HORIZON_DAYS: number; // how far ahead to materialize events
	CALENDAR_SYNC_PAST_GRACE_DAYS: number; // how far back to keep materializing
	CALENDAR_MAX_FEED_BYTES: number; // reject feeds larger than this
	CALENDAR_FETCH_TIMEOUT_MS: number; // abort a feed fetch after this long
	CALENDAR_MAX_OCCURRENCES: number; // cap expanded occurrences per feed per poll
};

function readEnv(name: string): string | undefined {
	const value = process.env[name];
	return value && value.length > 0 ? value : undefined;
}

function defaultDataDir(): string {
	return './data';
}

export function getEnv(): OpenIbexEnv {
	const dataDir = readEnv('OPENIBEX_DATA_DIR') ?? defaultDataDir();
	const openRegistrationRaw = (readEnv('OPEN_REGISTRATION') ?? 'false').toLowerCase();
	const openRegistration = openRegistrationRaw === 'true' || openRegistrationRaw === '1';
	const sessionTtlDaysRaw = readEnv('SESSION_TTL_DAYS');
	const sessionTtlDays = sessionTtlDaysRaw ? Number(sessionTtlDaysRaw) : 30;
	if (!Number.isFinite(sessionTtlDays) || sessionTtlDays <= 0) {
		throw new Error('SESSION_TTL_DAYS must be a positive number (example: 30)');
	}
	const validLogLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
	const logLevelRaw = (readEnv('LOG_LEVEL') ?? 'info').toLowerCase();
	const logLevel = validLogLevels.includes(logLevelRaw) ? logLevelRaw : 'info';
	// Positive-number env with a default; a malformed value falls back rather than
	// crashing boot (these knobs are non-critical tuning, unlike SESSION_TTL_DAYS).
	const numEnv = (name: string, fallback: number): number => {
		const raw = readEnv(name);
		if (raw === undefined) return fallback;
		const n = Number(raw);
		return Number.isFinite(n) && n > 0 ? n : fallback;
	};
	return {
		DATABASE_URL: readEnv('DATABASE_URL') ?? `file:${path.join(dataDir, 'openibex.db')}`,
		OPENIBEX_DATA_DIR: dataDir,
		OPENIBEX_UPLOAD_DIR: readEnv('OPENIBEX_UPLOAD_DIR') ?? path.join(dataDir, 'uploads'),
		OPENIBEX_STREAM_DIR: readEnv('OPENIBEX_STREAM_DIR') ?? path.join(dataDir, 'streams'),
		OPENIBEX_EXPORT_DIR: readEnv('OPENIBEX_EXPORT_DIR') ?? path.join(dataDir, 'exports'),
		OPENIBEX_IMPORT_DIR: readEnv('OPENIBEX_IMPORT_DIR') ?? path.join(dataDir, 'imports'),
		OPENIBEX_ENV: readEnv('OPENIBEX_ENV') ?? 'development',
		NODE_ENV: readEnv('NODE_ENV') ?? 'development',
		OPEN_REGISTRATION: openRegistration,
		SESSION_SECRET: readEnv('SESSION_SECRET'),
		SESSION_TTL_DAYS: sessionTtlDays,
		ORIGIN: readEnv('ORIGIN'),
		SYNC_ENCRYPTION_KEY: readEnv('SYNC_ENCRYPTION_KEY'),
		LOG_LEVEL: logLevel,
		CALENDAR_SYNC_THROTTLE_MS: numEnv('CALENDAR_SYNC_THROTTLE_MS', 15 * 60 * 1000),
		CALENDAR_SYNC_HORIZON_DAYS: numEnv('CALENDAR_SYNC_HORIZON_DAYS', 60),
		CALENDAR_SYNC_PAST_GRACE_DAYS: numEnv('CALENDAR_SYNC_PAST_GRACE_DAYS', 1),
		CALENDAR_MAX_FEED_BYTES: numEnv('CALENDAR_MAX_FEED_BYTES', 5_000_000),
		CALENDAR_FETCH_TIMEOUT_MS: numEnv('CALENDAR_FETCH_TIMEOUT_MS', 15_000),
		CALENDAR_MAX_OCCURRENCES: numEnv('CALENDAR_MAX_OCCURRENCES', 500)
	};
}

/**
 * Fail-fast configuration check, run once at server boot (from hooks.server.ts)
 * so missing/invalid required config crashes the process immediately with a
 * clear message — instead of surfacing lazily on the first request that needs
 * it (a session op, a sync, a cookie). Exported + pure-ish for unit testing.
 */
export function validateConfigOrThrow(): void {
	const env = getEnv(); // also validates SESSION_TTL_DAYS + LOG_LEVEL
	const isProd = env.NODE_ENV === 'production' || env.OPENIBEX_ENV === 'production';
	const problems: string[] = [];

	if (isProd && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16)) {
		problems.push('SESSION_SECRET must be set to at least 16 characters in production.');
	}
	if (isProd && !env.ORIGIN) {
		problems.push('ORIGIN must be set in production (used for the CSRF origin check and Secure cookies).');
	}
	// Optional, but if present it must be a valid 32-byte key — a malformed one
	// would otherwise only blow up the first time a user connects/syncs Garmin.
	if (env.SYNC_ENCRYPTION_KEY !== undefined) {
		let bytes = -1;
		try {
			bytes = Buffer.from(env.SYNC_ENCRYPTION_KEY, 'base64').length;
		} catch {
			bytes = -1;
		}
		if (bytes !== 32) {
			problems.push(
				'SYNC_ENCRYPTION_KEY must be base64 that decodes to exactly 32 bytes (generate: openssl rand -base64 32).'
			);
		}
	}

	if (problems.length > 0) {
		throw new Error(`Invalid OpenIbex configuration:\n  - ${problems.join('\n  - ')}`);
	}
}
