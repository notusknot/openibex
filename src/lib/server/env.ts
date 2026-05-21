import path from 'node:path';

export type OpenIbexEnv = {
	DATABASE_URL: string;
	OPENIBEX_DATA_DIR: string;
	OPENIBEX_UPLOAD_DIR: string;
	OPENIBEX_STREAM_DIR: string;
	OPENIBEX_ENV: string;
	NODE_ENV: string;
	OPEN_REGISTRATION: boolean;
	SESSION_SECRET?: string;
	SESSION_TTL_DAYS: number;
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
		OPENIBEX_ENV: readEnv('OPENIBEX_ENV') ?? 'development',
		NODE_ENV: readEnv('NODE_ENV') ?? 'development',
		OPEN_REGISTRATION: openRegistration,
		SESSION_SECRET: readEnv('SESSION_SECRET'),
		SESSION_TTL_DAYS: sessionTtlDays
	};
}
