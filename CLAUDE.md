# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Self-hosted training platform for endurance athletes. Single-container deployment, SQLite-first, no external integrations. Stack: SvelteKit + TypeScript (Node adapter), Drizzle ORM over `better-sqlite3`, pnpm. The product spec lives in `openibex_sveltekit_prd.md` and analytics formulas in `docs/analytics.md`.

## Commands

```bash
pnpm dev                  # vite dev on 0.0.0.0:3000
pnpm build && pnpm start  # production build, served via adapter-node
pnpm check                # svelte-kit sync + svelte-check (type/svelte checks)
pnpm test                 # vitest run
pnpm test:watch           # vitest in watch mode
pnpm vitest run src/path/to/file.test.ts            # single file
pnpm vitest run -t "name of test"                   # filter by name

pnpm db:generate          # generate a new migration from schema.ts diff
pnpm db:migrate           # apply migrations (also runs automatically on server start)
pnpm db:studio            # drizzle studio

pnpm import:garmin -- --user you@example.com --path /path/to/extracted/garmin-export
pnpm analytics:rebuild -- --user you@example.com
```

The Nix devshell (`flake.nix`, auto-loaded via `direnv allow`) pins Node 22, pnpm, sqlite, and the native toolchain for `better-sqlite3`, and pre-exports `DATABASE_URL` + the `OPENIBEX_*` data dir vars. Outside the devshell, copy `.env.example` to `.env` first.

If `/api/health` fails with a `better-sqlite3` bindings error: `pnpm rebuild better-sqlite3`.

## Architecture

**Layering (load-bearing — preserves the option of a future Go API).** Routes call services, services call repositories, repositories are the only layer that touches Drizzle/SQLite. Don't query the DB from a `+page.server.ts` or `+server.ts` directly; go through `src/lib/server/services/*` → `src/lib/server/repositories/*`. The schema lives in `src/lib/server/db/schema.ts`; migrations are SQL files under `drizzle/`.

**Route groups and auth.** Routes split into `src/routes/(public)/` (login, register, marketing) and `src/routes/(app)/` (everything authenticated: dashboard, activities, calendar, analytics, imports, settings). `src/hooks.server.ts` resolves the session cookie (`openibex_session`) into `event.locals.user`, redirects unauthenticated users on protected paths to `/login`, and bounces authenticated users away from `/login`/`/register` to `/dashboard`. Public exceptions are listed in `PUBLIC_PATHS`/`PUBLIC_PREFIXES` at the top of that file — update them there, not by sprinkling checks in routes. The hook also sets baseline security headers on every response.

**Database client.** `src/lib/server/db/client.ts` lazily opens one `better-sqlite3` connection per process with `journal_mode=WAL` and `foreign_keys=ON`, then calls `ensureMigrations()` (gated by a module-level flag so it only runs once per process). This means migrations apply automatically on first DB access in dev, tests, and production — `pnpm db:migrate` is still the recommended dev workflow but is not required at boot. Tests can reset the singleton via `resetDbForTests()`.

**Environment.** All env reads go through `getEnv()` in `src/lib/server/env.ts`. It normalizes defaults (e.g. `OPENIBEX_DATA_DIR` defaults to `./data`, the other dir vars derive from it) and validates `SESSION_TTL_DAYS`. Don't read `process.env.*` directly elsewhere — add a field to `OpenIbexEnv` instead.

**Filesystem layout (bind-mounted to `/data` in Docker, `./data` in dev).**
- `data/openibex.db` (+ WAL/SHM) — SQLite
- `data/uploads/<userId>/<sha256>.fit` — raw FIT uploads
- `data/streams/<activityId>.json.gz` — parsed time-series streams
- `data/imports/<batch_id>/originals/<sha256>.fit` — Garmin bulk import originals
- `data/exports/` — user data exports

**FIT parsing and Garmin bulk import.** Single-file uploads go through `services/fitImportService.ts` (parser in `src/lib/server/parsers/fit/`). The bulk importer is a separate CLI (`scripts/import-garmin.ts`) that walks a Garmin data export directory, recursively unzipping, dedupes by SHA-256, and records per-file failures in the `import_items` table without aborting the batch. It writes to the same `activities` + `streams` storage as the upload path; results show at `/imports`.

**Auth.** Session tokens are random bytes; only the SHA-256 hash is stored (`sessionsRepository`). Passwords use the helpers in `src/lib/server/security/`. First registered user becomes `admin`; further registration is gated by `OPEN_REGISTRATION` env var.

**Analytics.** Live pages read directly from `activities`. The optional `daily_metrics` cache table is rebuilt via `pnpm analytics:rebuild`; not required for correctness. JSON endpoint: `/api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD`.

## Out of scope (intentionally)

GPX/TCX import, external integrations, OAuth, and coach workflows are deliberately not implemented yet. Don't add them speculatively.
