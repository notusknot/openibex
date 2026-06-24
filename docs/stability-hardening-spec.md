> ℹ️ **Wave-1 SHIPPED — retained as design rationale.** Everything specified below has landed; this doc is kept because the code (`src/lib/server/db/client.ts`, `shutdown.ts`, `db/schema.ts`) cites it for the *why*. For current state see `CHANGELOG.md`. Read the sections as historical rationale, not a to-do list.

# OpenIbex — Stability Hardening Spec (Wave 1 backend core)

Three changes that close the highest-severity data-safety / concurrency / reliability holes, in plug-into-Claude-Code form. They are independent — land them in order, each as its own PR.

1. **SQLite pragmas** — correct durability, integrity, and concurrency at the connection level.
2. **Graceful shutdown** — never truncate a write when Docker restarts the container.
3. **DB-backed sync job + lock** — replace the in-memory throttle/in-flight map that dies on restart and races across processes/tabs.

Assumes the existing stack: SvelteKit + TypeScript + Drizzle + better-sqlite3, single Docker container, `adapter-node`.

---

## 1. SQLite pragmas

### Why
SQLite's defaults are tuned for embedded/CLI use, not a server with a write-on-page-load sync. Three defaults actively hurt you:
- **`foreign_keys` is OFF by default**, per connection → your FK constraints are currently not enforced.
- The default rollback journal blocks readers during writes; **WAL** allows concurrent reads.
- Without **`busy_timeout`**, a second writer throws `SQLITE_BUSY` immediately instead of waiting.

### Where
Wherever the better-sqlite3 `Database` is constructed and handed to Drizzle (e.g. `src/lib/server/db/index.ts`). Pragmas must run **on the connection, before first use**. better-sqlite3 is a single long-lived connection, so set once at construction.

### Change

```ts
// src/lib/server/db/index.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const sqlite = new Database(DB_PATH);

// Order matters: journal_mode before heavy use; the rest are idempotent.
sqlite.pragma('journal_mode = WAL');     // concurrent readers + crash resilience
sqlite.pragma('synchronous = NORMAL');   // correct durability under WAL
sqlite.pragma('foreign_keys = ON');      // OFF by default — enforce integrity
sqlite.pragma('busy_timeout = 5000');    // wait up to 5s instead of SQLITE_BUSY
sqlite.pragma('cache_size = -16000');    // ~16MB page cache (negative = KiB)
sqlite.pragma('temp_store = MEMORY');

export const db = drizzle(sqlite, { schema });
export { sqlite }; // exported so the shutdown handler can checkpoint + close
```

### Verify
- `sqlite.pragma('journal_mode', { simple: true })` returns `'wal'`.
- `sqlite.pragma('foreign_keys', { simple: true })` returns `1`.
- Insert a child row with a bad FK → it now throws (proves enforcement; previously silently allowed). Add this as a test.
- A `-wal` and `-shm` file appear next to the DB file.

### Notes
- **Litestream is compatible with WAL** (it relies on it) — these pragmas are a prerequisite for the backup work, not a conflict.
- If any migration assumed FKs were unenforced, enabling them may surface a real pre-existing integrity violation. Run against a copy of prod data once before shipping.

---

## 2. Graceful shutdown

### Why
Docker sends **SIGTERM** on every deploy, restart, and `docker stop`, then SIGKILLs after a grace period. If the process dies mid-write you risk a truncated transaction or an un-checkpointed WAL. A mature app drains in-flight work, checkpoints, and closes the DB cleanly.

### Where
A small server-lifecycle module imported for side effects from the server entry. With `adapter-node` you have a Node process; register handlers once at startup (e.g. `src/lib/server/shutdown.ts`, imported from `src/hooks.server.ts` so it loads with the server).

### Change

```ts
// src/lib/server/shutdown.ts
import { sqlite } from './db';

let shuttingDown = false;

// Set true while a sync (or any critical write) is running; the sync
// service should check isShuttingDown() before starting new work.
let inFlight = 0;
export function beginCriticalWork() { inFlight++; }
export function endCriticalWork() { inFlight = Math.max(0, inFlight - 1); }
export function isShuttingDown() { return shuttingDown; }

async function drain(timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (inFlight > 0 && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received, draining…`);
  try {
    await drain();                         // let in-flight writes finish
    sqlite.pragma('wal_checkpoint(TRUNCATE)'); // fold WAL back into the db file
    sqlite.close();                        // clean close
    console.log('[shutdown] db closed cleanly');
    process.exit(0);
  } catch (err) {
    console.error('[shutdown] error during shutdown', err);
    process.exit(1);
  }
}

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => void shutdown(sig));
}
```

```ts
// src/hooks.server.ts  — ensure the module loads with the server
import './lib/server/shutdown';
```

Then in the sync orchestrator, guard new work:

```ts
import { isShuttingDown, beginCriticalWork, endCriticalWork } from '$lib/server/shutdown';

export async function syncForUser(userId: number) {
  if (isShuttingDown()) return { skipped: 'shutting_down' };
  beginCriticalWork();
  try { /* …existing sync… */ }
  finally { endCriticalWork(); }
}
```

### Verify
- Locally: start the app, kick off a sync, send SIGTERM (`kill -TERM <pid>` or `docker stop`), confirm logs show drain → checkpoint → clean close, and the `-wal` file shrinks/disappears.
- Set Docker's `stop_grace_period` (compose) ≥ your drain timeout so SIGKILL doesn't pre-empt the drain.

### Notes
- Keep the drain timeout modest (10s) — longer than Docker's grace period just gets you SIGKILLed anyway.
- This is also where you'd later stop accepting new HTTP connections; for now draining writes is the part that protects data.

---

## 3. DB-backed sync job + lock

### Why
You already documented the weakness: the in-memory throttle map and in-flight guard **reset on process restart and don't work across multiple processes**. Concretely that means two browser tabs (or a restart mid-sync) can launch overlapping syncs, double-processing and racing on writes. The fix is to move the throttle + lock into the database so it's durable and atomic.

### Schema (`src/lib/server/db/schema.ts`)

```ts
export const syncJobs = sqliteTable('sync_jobs', {
  userId: integer('user_id').primaryKey().references(() => users.id),
  // lock
  status: text('status').notNull().default('idle'), // idle | running | failed
  lockedAt: integer('locked_at', { mode: 'timestamp' }),
  lockedBy: text('locked_by'),        // process/instance id, for debugging
  // throttle
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  lastStatus: text('last_status'),    // ok | auth_failed | error
  lastError: text('last_error'),      // redacted message
});
```

One row per user; create lazily on first sync. (If you prefer not to gate on a separate table, these columns could live on `garmin_credentials` — but a dedicated table keeps sync state separate from auth state.)

### Lock acquisition — atomic, expiring

The key idea: **claim the row in a single conditional UPDATE inside a transaction**, so only one caller wins even under concurrency. The lock auto-expires (stale-lock recovery) in case a process died holding it without releasing.

```ts
// src/lib/server/services/sync/syncLock.ts
import { db, sqlite } from '$lib/server/db';
import { syncJobs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const THROTTLE_MS = 15 * 60 * 1000; // 15 min, matching current behavior
const LOCK_TTL_MS = 10 * 60 * 1000; // a sync may run up to 10 min before lock is stale
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

/** Returns true if the caller acquired the lock and should run the sync. */
export function tryAcquireSync(userId: number, opts?: { ignoreThrottle?: boolean }): boolean {
  const now = Date.now();
  // better-sqlite3 transactions are synchronous and atomic.
  const txn = sqlite.transaction(() => {
    const row = db.select().from(syncJobs).where(eq(syncJobs.userId, userId)).get();

    if (!row) {
      db.insert(syncJobs).values({
        userId, status: 'running', lockedAt: new Date(now), lockedBy: INSTANCE_ID, lastRunAt: null,
      }).run();
      return true;
    }

    const isLocked = row.status === 'running'
      && row.lockedAt
      && now - row.lockedAt.getTime() < LOCK_TTL_MS;        // honor live locks
    if (isLocked) return false;

    const throttled = !opts?.ignoreThrottle
      && row.lastRunAt
      && now - row.lastRunAt.getTime() < THROTTLE_MS;        // honor throttle
    if (throttled) return false;

    db.update(syncJobs).set({
      status: 'running', lockedAt: new Date(now), lockedBy: INSTANCE_ID,
    }).where(eq(syncJobs.userId, userId)).run();
    return true;
  });
  return txn();
}

export function releaseSync(userId: number, result: { ok: boolean; status: string; error?: string }) {
  db.update(syncJobs).set({
    status: result.ok ? 'idle' : 'failed',
    lockedAt: null,
    lockedBy: null,
    lastRunAt: new Date(),
    lastStatus: result.status,
    lastError: result.error ?? null, // already redacted upstream
  }).where(eq(syncJobs.userId, userId)).run();
}
```

### Wire into the trigger

Replace the in-memory `maybeTriggerAutoSync` guts:

```ts
// src/routes/(app)/+layout.server.ts (auto-sync, fire-and-forget)
import { tryAcquireSync, releaseSync } from '$lib/server/services/sync/syncLock';

export function maybeTriggerAutoSync(userId: number) {
  if (!tryAcquireSync(userId)) return;          // throttled, locked, or disabled
  // fire-and-forget; do NOT await (keep page load non-blocking)
  (async () => {
    let result = { ok: false, status: 'error', error: undefined as string | undefined };
    try {
      const summary = await syncForUser(userId); // existing pipeline
      result = { ok: true, status: 'ok', error: undefined };
    } catch (e) {
      result = { ok: false, status: classify(e), error: redact(String(e)) };
    } finally {
      releaseSync(userId, result);
    }
  })();
}
```

The manual "Sync Now" button calls `tryAcquireSync(userId, { ignoreThrottle: true })` so it bypasses the 15-min window but still respects the lock (won't collide with an in-flight auto-sync).

### Interaction with shutdown (§2)
- `syncForUser` already calls `beginCriticalWork()`/`endCriticalWork()`, so the drain waits for an in-flight sync.
- Because the lock auto-expires after `LOCK_TTL_MS`, a process that's SIGKILLed mid-sync won't leave the user permanently locked — the next run reclaims the stale lock.
- Optional belt-and-suspenders: on startup, reset any `status = 'running'` rows owned by a previous instance to `idle` (they can't be live after a restart).

### Verify
- Open two tabs / fire two requests near-simultaneously → exactly one sync runs (add a log line on acquire; assert single acquisition in a test using a fake clock).
- Within 15 min, auto-sync is skipped; "Sync Now" still runs.
- Kill the process mid-sync, restart → after `LOCK_TTL_MS` (or via the startup reset) the next sync proceeds; no permanent lock.
- `auth_failed` from the pipeline persists to `lastStatus` and the existing reconnect gate still applies.

### Notes
- This stays correct even if you later run **multiple processes/containers** against the same DB, because the lock is a single atomic UPDATE — which the in-memory version could never be.
- Surfacing `lastRunAt` / `lastStatus` in the UI (the "honest sync status" checklist item) is now a trivial read from this table.

---

## Build order
1. **Pragmas** (§1) — smallest, unblocks Litestream, immediate integrity/concurrency win. Add the FK-enforcement test.
2. **Graceful shutdown** (§2) — protects every write from deploy-time truncation; needed before you rely on §3's in-flight draining.
3. **DB-backed sync job** (§3) — depends on nothing but benefits from §2's drain hooks; removes the documented in-memory fragility.

Each is independently shippable and independently revertable.
