import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { getEnv } from '$lib/server/env';
import { sqlitePathFromDatabaseUrl } from '$lib/server/db/sqlitePath';
import * as schema from '$lib/server/db/schema';
import { ensureMigrations, resetMigrationsForTests } from '$lib/server/db/migrations';

let db: BetterSQLite3Database<typeof schema> | null = null;
let sqlite: Database.Database | null = null;

function ensureDirs() {
	const env = getEnv();
	fs.mkdirSync(env.OPENIBEX_DATA_DIR, { recursive: true });
	fs.mkdirSync(env.OPENIBEX_UPLOAD_DIR, { recursive: true });
	fs.mkdirSync(env.OPENIBEX_STREAM_DIR, { recursive: true });
	fs.mkdirSync(env.OPENIBEX_EXPORT_DIR, { recursive: true });
}

export function getDb() {
	if (db) return db;

	const env = getEnv();
	ensureDirs();

	const sqlitePath = sqlitePathFromDatabaseUrl(env.DATABASE_URL);
	fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

	sqlite = new Database(sqlitePath);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	db = drizzle(sqlite, { schema });
	ensureMigrations(db);
	return db;
}

export function resetDbForTests(): void {
	if (sqlite) {
		sqlite.close();
	}
	sqlite = null;
	db = null;
	resetMigrationsForTests();
}
