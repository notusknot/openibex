import { sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db/client';

/** Actually exercise the connection (not just open it) so a corrupt/unreachable
 * DB surfaces as a failed health check. */
export async function pingDatabase(): Promise<void> {
	const db = getDb();
	db.get(sql`select 1`);
}

/** Aggregate, non-PII operational signal: how many users' syncs are currently
 * failed or sitting in a breaker cool-down. No per-user rows / no error text —
 * safe to expose on the public /health endpoint. */
export function countFailingSyncJobs(nowMs: number = Date.now()): number {
	const db = getDb();
	const row = db.get<{ n: number }>(
		sql`select count(*) as n from sync_jobs
		    where status = 'failed' or (cooldown_until is not null and cooldown_until > ${nowMs})`
	);
	return row?.n ?? 0;
}
