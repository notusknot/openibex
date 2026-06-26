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
	fs.mkdirSync(env.OPENIBEX_IMPORT_DIR, { recursive: true });
}

export function getDb() {
	if (db) return db;

	const env = getEnv();
	ensureDirs();

	const sqlitePath = sqlitePathFromDatabaseUrl(env.DATABASE_URL);
	fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

	sqlite = new Database(sqlitePath);
	// Pragmas are per-connection and must be set before first use. better-sqlite3
	// is a single long-lived connection, so setting them once here covers the
	// whole process. SQLite's defaults are tuned for embedded/CLI use, not a
	// server with a write-on-page-load sync — these correct durability,
	// integrity, and concurrency. See docs/stability-hardening-spec.md §1.
	sqlite.pragma('journal_mode = WAL'); // concurrent readers + crash resilience
	sqlite.pragma('synchronous = NORMAL'); // correct durability/speed balance under WAL
	sqlite.pragma('foreign_keys = ON'); // OFF by default in SQLite — enforce integrity
	sqlite.pragma('busy_timeout = 5000'); // wait up to 5s for a writer instead of SQLITE_BUSY
	sqlite.pragma('cache_size = -16000'); // ~16MB page cache (negative value = KiB)
	sqlite.pragma('temp_store = MEMORY'); // keep temp b-trees off disk
	db = drizzle(sqlite, { schema });
	ensureMigrations(db, sqlite, sqlitePath);
	return db;
}

/**
 * Fold the WAL back into the main db file and close the connection cleanly.
 * Called by the graceful-shutdown handler on SIGTERM/SIGINT so a deploy or
 * restart never truncates a write or leaves an un-checkpointed WAL behind.
 * No-op if the connection was never opened. Idempotent.
 */
export function checkpointAndCloseDb(): void {
	if (!sqlite) return;
	try {
		sqlite.pragma('wal_checkpoint(TRUNCATE)');
	} finally {
		sqlite.close();
		sqlite = null;
		db = null;
	}
}

export function resetDbForTests(): void {
	if (sqlite) {
		sqlite.close();
	}
	sqlite = null;
	db = null;
	resetMigrationsForTests();
}
