# Architecture

How data moves through OpenIbex and *why* the non-obvious decisions are the way they are. For
domain formulas (load, PMC, dedup rules) see [DOMAIN.md](DOMAIN.md). For day-one orientation see
[../CLAUDE.md](../CLAUDE.md).

## Layering (the load-bearing rule)

```
route (+page.server.ts / +server.ts)
  → service   (src/lib/server/services/*)
    → repository (src/lib/server/repositories/*)
      → Drizzle / better-sqlite3
```

Routes never touch the DB directly; **repositories are the only layer that imports Drizzle**, and
UI components never import DB row shapes. *Why:* this keeps a future Go API a drop-in
possibility — the service boundary is the seam where the backend could be swapped, so business
logic stays out of both the route handlers and the SQL layer. Treat a DB query in a `+page.server.ts`
as a bug.

## Request lifecycle & auth

`src/hooks.server.ts` resolves the `openibex_session` cookie into `event.locals.user`, redirects
unauthenticated users on protected paths to `/login`, bounces authenticated users away from
`/login`/`/register`, and sets baseline security headers on every response. Public exceptions live
in `PUBLIC_PATHS` / `PUBLIC_PREFIXES` at the top of that file — change them there, not by
sprinkling checks in routes. Routes are split into `src/routes/(public)/` and
`src/routes/(app)/`.

## Data flow: three ingestion paths, one store

All paths converge on the same storage: `activities` + `activity_files` rows and a gzip
`streams/<activityId>.json.gz` blob.

**1. Single FIT upload** (`POST /activities/upload` → `fitImportService`)
SHA-256 the bytes and reject duplicates up front → write the FIT to disk *outside* the DB
transaction → parse → commit `activity_file` + `activity` **atomically** → write the gzip stream.

**2. Live Garmin Connect sync — experimental** (`(app)/+layout.server.ts` → `syncService`)
`maybeTriggerAutoSync()` fires on app page loads. It acquires the per-user lock in `sync_jobs`
(throttled to once / 15 min; a manual *Sync now* bypasses the throttle but still respects the
lock), logs in through the unofficial `garmin-connect` library (`sync/garmin.ts`, tokens sealed
with `SYNC_ENCRYPTION_KEY`), lists activities newer than the cursor (`garmin_credentials.lastSyncAt`),
applies the 3-layer dedup, downloads + parses each FIT, stores it, advances the cursor, and
releases the lock. Failures trip a circuit breaker with exponential backoff (also in `sync_jobs`).
There is **no background worker** — sync only happens when someone opens the app.

**3. Offline bulk import — CLI** (`scripts/import-garmin.ts` → `garminImportService`)
Walks a Garmin data-export directory, recursively unzips (`jszip`) to temp, discovers `.fit`
files, dedupes by SHA-256, parses, and stores — recording **per-file** outcomes in `import_items`
under an `import_batches` row so one bad file never aborts the batch. No Garmin API or credentials.
Results surface at `/imports`.

## FIT parsing — why a worker thread

`fit-file-parser` is synchronous and CPU-bound. Parsing runs in a **worker thread**
(`src/lib/server/parsers/fit/`) with a **parse-time deadline (~15 s)** and a **record cap
(~250k)**. *Why:* a large or maliciously crafted FIT file could otherwise block the event loop or
blow up memory during `JSON.stringify` + gzip; the worker + deadline + cap bound the blast radius.

## Database client & durability — why these choices

`src/lib/server/db/client.ts` lazily opens **one** `better-sqlite3` connection per process
(SQLite is single-writer) and applies a hardened pragma set: `journal_mode=WAL` (concurrent reads
+ crash resilience), `foreign_keys=ON`, `busy_timeout=5000`, plus cache/temp tuning. It calls
`ensureMigrations()` once per process (module-level flag), so migrations auto-apply on first DB
access in dev, test, and prod; `pnpm db:migrate` is the recommended dev workflow but not required
at boot. Tests reset the singleton via `resetDbForTests()`.

**Graceful shutdown** (`shutdown.ts`): on `SIGTERM`, drain in-flight critical work (sync/import
write sections tracked by `beginCriticalWork`/`endCriticalWork`), `WAL_CHECKPOINT(TRUNCATE)`, then
close the DB — so a restart never finds an orphaned WAL. `/api/health` exposes `inFlightWrites`
and `syncFailing` so orchestration can verify the drain and watch sync health.

**Why `sync_jobs` is DB-backed (not an in-memory map).** The lock + throttle + circuit breaker
used to live in a process-local map/set. That lost all state on restart and couldn't coordinate
across processes or browser tabs (auto-sync fires from every page load). Moving it into the
`sync_jobs` table makes the lock, throttle, backoff, and cooldown durable and shared.

## Analytics surfaces

The dashboard reads live from `activities` and computes the PMC (Fitness/Fatigue/Form) via an EWMA
over an 84-day window — see [DOMAIN.md](DOMAIN.md). There is a single PMC code path. (A former
`/analytics` page and its `daily_metrics` cache were removed: the page was unused and the cache was
write-only, so they were dead weight and a second, divergent way to compute the same numbers.)

## Storage layout (bind-mounted to `/data` in Docker, `./data` in dev)

- `data/openibex.db` (+ WAL/SHM) — SQLite
- `data/uploads/<userId>/<sha256>.fit` — raw FIT uploads
- `data/streams/<activityId>.json.gz` — parsed time-series streams
- `data/imports/<batch_id>/originals/<sha256>.fit` — bulk-import originals
- `data/exports/` — user data exports

## Environment

All env reads go through `getEnv()` in `src/lib/server/env.ts`, which normalizes defaults
(`OPENIBEX_DATA_DIR` → the other dir vars) and validates config at boot (fail-fast on missing/
invalid secrets). Don't read `process.env.*` elsewhere — add a field to `OpenIbexEnv` instead.

## Key modules

| Concern | Path |
|---|---|
| Live sync orchestration | `src/lib/server/services/sync/syncService.ts` |
| garmin-connect adapter (login, token sealing) | `src/lib/server/sync/garmin.ts` |
| Sync lock / throttle / circuit breaker | `src/lib/server/repositories/syncJobsRepository.ts` |
| Bulk offline import | `src/lib/server/services/imports/garminImportService.ts` |
| Single FIT upload | `src/lib/server/services/fitImportService.ts` |
| FIT parsing (worker) | `src/lib/server/parsers/fit/` |
| Load / TSS | `src/lib/server/services/analytics/load.ts` |
| Dashboard PMC + KPI bands | `src/lib/server/services/dashboardService.ts` |
| Schema (source of truth) | `src/lib/server/db/schema.ts` |
| DB client + pragmas + migrations | `src/lib/server/db/client.ts` |
| Graceful shutdown | `src/lib/server/db/shutdown.ts` |
| Health | `src/routes/api/health/+server.ts` → `services/healthService.ts` |
