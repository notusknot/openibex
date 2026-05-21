import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';

let migrated = false;

export function ensureMigrations(db: BetterSQLite3Database<typeof schema>): void {
	if (migrated) return;
	const migrationsFolder = path.resolve('drizzle');
	migrate(db, { migrationsFolder });
	migrated = true;
}

export function resetMigrationsForTests(): void {
	migrated = false;
}
