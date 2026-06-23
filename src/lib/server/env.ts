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
		SYNC_ENCRYPTION_KEY: readEnv('SYNC_ENCRYPTION_KEY')
	};
}
