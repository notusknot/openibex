import fs from 'node:fs';
import path from 'node:path';
import type BetterSqlite3 from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';
import { getLogger } from '$lib/server/logger';

let migrated = false;

/** Total migrations defined in the drizzle journal (the target state). */
function totalMigrations(migrationsFolder: string): number {
	try {
		const journal = JSON.parse(
			fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')
		) as { entries?: unknown[] };
		return journal.entries?.length ?? 0;
	} catch {
		return 0;
	}
}

/** Migrations already applied to this DB. 0 on a fresh DB (table absent). */
function appliedMigrations(sqlite: BetterSqlite3.Database): number {
	try {
		const row = sqlite
			.prepare('SELECT count(*) AS c FROM __drizzle_migrations')
			.get() as { c: number } | undefined;
		return row?.c ?? 0;
	} catch {
		return 0; // table doesn't exist yet → nothing applied
	}
}

/**
 * Back up an existing, already-migrated DB before applying NEW migrations.
 *
 * Why: migrations auto-apply on first DB access on every container start, against
 * the self-hoster's live prod DB. A migration that fails partway (or applies a
 * destructive DDL the operator didn't expect) would otherwise leave a half-
 * upgraded DB with no recovery point — and the app won't boot to let them fix it.
 * `VACUUM INTO` writes a clean, fully-checkpointed copy (WAL folded in) cheaply.
 *
 * Only runs when there's something to protect: an existing DB (>=1 applied
 * migration) with pending ones. A brand-new DB has no data to lose, and a
 * no-op boot (nothing pending) skips it so we don't snapshot on every restart.
 */
function backupBeforeMigrate(sqlite: BetterSqlite3.Database, dbPath: string): void {
	const target = `${dbPath}.pre-migrate-${Date.now()}.bak`;
	// VACUUM INTO requires the target not exist; the timestamp keeps it unique.
	sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
	getLogger().warn(
		{ backup: target },
		'Pending DB migration(s) detected — wrote a pre-migration backup before applying.'
	);
}

export function ensureMigrations(
	db: BetterSQLite3Database<typeof schema>,
	sqlite?: BetterSqlite3.Database,
	dbPath?: string
): void {
	if (migrated) return;
	const migrationsFolder = path.resolve('drizzle');

	// Snapshot before touching a populated DB that has unapplied migrations.
	if (sqlite && dbPath) {
		try {
			const applied = appliedMigrations(sqlite);
			const total = totalMigrations(migrationsFolder);
			if (applied > 0 && total > applied) {
				backupBeforeMigrate(sqlite, dbPath);
			}
		} catch (err) {
			// A failed backup must not block migration in normal operation, but it
			// should be loud — the operator loses the safety net for this upgrade.
			getLogger().error({ err }, 'Pre-migration DB backup failed; continuing with migration.');
		}
	}

	migrate(db, { migrationsFolder });
	migrated = true;
}

export function resetMigrationsForTests(): void {
	migrated = false;
}
