import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { getEnv } from '$lib/server/env';
import { sqlitePathFromDatabaseUrl } from '$lib/server/db/sqlitePath';
import * as schema from '$lib/server/db/schema';

let db: BetterSQLite3Database<typeof schema> | null = null;

function ensureDirs() {
	const env = getEnv();
	fs.mkdirSync(env.OPENIBEX_DATA_DIR, { recursive: true });
	fs.mkdirSync(env.OPENIBEX_UPLOAD_DIR, { recursive: true });
	fs.mkdirSync(env.OPENIBEX_STREAM_DIR, { recursive: true });
}

export function getDb() {
	if (db) return db;

	const env = getEnv();
	ensureDirs();

	const sqlitePath = sqlitePathFromDatabaseUrl(env.DATABASE_URL);
	fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

	const sqlite = new Database(sqlitePath);
	db = drizzle(sqlite, { schema });
	return db;
}
