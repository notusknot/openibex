import path from 'node:path';

export type OpenIbexEnv = {
	DATABASE_URL: string;
	OPENIBEX_DATA_DIR: string;
	OPENIBEX_UPLOAD_DIR: string;
	OPENIBEX_STREAM_DIR: string;
	OPENIBEX_ENV: string;
	NODE_ENV: string;
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
	return {
		DATABASE_URL: readEnv('DATABASE_URL') ?? `file:${path.join(dataDir, 'openibex.db')}`,
		OPENIBEX_DATA_DIR: dataDir,
		OPENIBEX_UPLOAD_DIR: readEnv('OPENIBEX_UPLOAD_DIR') ?? path.join(dataDir, 'uploads'),
		OPENIBEX_STREAM_DIR: readEnv('OPENIBEX_STREAM_DIR') ?? path.join(dataDir, 'streams'),
		OPENIBEX_ENV: readEnv('OPENIBEX_ENV') ?? 'development',
		NODE_ENV: readEnv('NODE_ENV') ?? 'development'
	};
}
