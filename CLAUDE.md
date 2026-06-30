# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repo. Keep it short — it loads every
session. Deeper docs are linked; read them when a task needs them.

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — data flow + the *why* behind non-obvious decisions.
- **[docs/DOMAIN.md](docs/DOMAIN.md)** — load / PMC formulas, dedup guarantees, data-model invariants.
- **[CHANGELOG.md](docs/CHANGELOG.md)** — what shipped. **[ROADMAP.md](docs/ROADMAP.md)** — what's planned.
- **[docs/development.md](docs/development.md)** — branch protection + where the real enforcement is.

## What this is

Self-hosted training platform for endurance athletes. Single-container, SQLite-first. Stack:
SvelteKit + TypeScript (`@sveltejs/adapter-node`), Drizzle ORM over `better-sqlite3`, pnpm.
Ingests FIT files three ways — single upload, an **experimental live Garmin Connect sync**, and an
offline Garmin-export bulk-import CLI — then computes training-load analytics.

## Commands

```bash
pnpm dev                  # vite dev on 0.0.0.0:3000
pnpm build && pnpm start  # production build, served via adapter-node
pnpm check                # svelte-kit sync + svelte-check — the canonical typecheck/lint gate
pnpm test                 # vitest run    (pnpm test:watch for watch mode)
pnpm vitest run src/path/to/file.test.ts   # single file   (-t "name" to filter)

pnpm db:generate          # generate a migration from schema.ts diff
pnpm db:migrate           # apply migrations (also auto-runs on first DB access)
pnpm db:studio            # drizzle studio

pnpm import:garmin -- --user you@example.com --path /path/to/extracted/garmin-export
pnpm metrics:rebuild -- --user you@example.com   # recompute per-activity stream metrics
pnpm audit                # pnpm audit --prod
```

There is **no ESLint/Prettier and no separate typecheck script** — `pnpm check` (svelte-check) is
the single static gate. The Nix devshell (`flake.nix`, via `direnv allow`) pins Node 22 + pnpm +
the `better-sqlite3` toolchain and pre-exports the env vars; otherwise copy `.env.example` to `.env`.
If `/api/health` fails with a `better-sqlite3` bindings error: `pnpm rebuild better-sqlite3`.

## Directory map

```
src/routes/(public)/   login, register            src/lib/server/
src/routes/(app)/      dashboard, activities,        services/      business logic
                       calendar, imports,            repositories/  the ONLY layer touching Drizzle
                       settings                      db/            schema.ts, client.ts, shutdown.ts
src/routes/api/        health                        parsers/fit/   FIT parsing (worker thread)
drizzle/               SQL migrations                sync/          garmin-connect adapter
scripts/               CLIs (import-garmin, …)        security/, env.ts
```

## Conventions (the load-bearing ones)

- **Layering:** route → service → repository → Drizzle. Never query the DB from a `+page.server.ts`
  or `+server.ts`; go through `services/*` → `repositories/*`. This preserves the option of a future
  Go API. Details in [ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Auth / routing:** `src/hooks.server.ts` resolves the `openibex_session` cookie into
  `locals.user`, guards protected paths, and sets security headers. Public exceptions go in
  `PUBLIC_PATHS` / `PUBLIC_PREFIXES` there — not scattered in routes.
- **Env:** read only via `getEnv()` (`src/lib/server/env.ts`); add a field to `OpenIbexEnv` rather
  than touching `process.env` elsewhere.
- **Schema** is `src/lib/server/db/schema.ts`; migrations are SQL under `drizzle/`.

## Critical gotchas

- **Garmin Connect sync is experimental and fragile.** It uses the **unofficial**
  `garmin-connect` library (email/password, no MFA, against Garmin's TOS). It auto-syncs on app
  page loads, **throttled to once / 15 min**, with a manual *Sync now*. **There is no background
  worker.**
- **Sync coordination is DB-backed, not in-memory.** The lock, throttle, backoff, and circuit
  breaker live in the `sync_jobs` table (one row per user) — durable across restarts and shared
  across processes/tabs. Don't reintroduce a process-local map.
- **FIT parsing runs in a worker thread** with a parse-time deadline and a record cap — large or
  crafted files must not block the event loop. Don't move parsing back onto the main thread.
- **SQLite is single-writer.** One `better-sqlite3` connection per process, WAL + `foreign_keys=ON`
  + `busy_timeout`. Graceful shutdown drains writes and checkpoints the WAL on `SIGTERM`.
- **PMC math lives in `dashboardService`** (EWMA CTL/ATL/TSB over an 84-day window) — the single
  source of training-load truth. Day bucketing uses the app timezone (`OPENIBEX_TZ`, via
  `src/lib/server/time.ts`), not the server clock. See [DOMAIN.md](docs/DOMAIN.md) before touching
  the load/PMC formulas.

## Development Workflow

These rules are partly enforced by hooks + CI (see [docs/development.md](docs/development.md) for
which gates are real). Follow them regardless:

- **Branch per feature. Never commit directly to `main`.**
- **Every code change ships its CHANGELOG entry** under `[Unreleased]` in the *same* commit.
- **Run `pnpm check` + `pnpm test` before proposing a merge.**
- **Version bumps + git tags happen only at release** — cut `[Unreleased]` into a dated
  `[x.y.z]` block and bump `package.json`. Not on every feature merge.

## Out of scope (intentionally)

GPX/TCX import, *official* OAuth-based third-party integrations, and coach workflows are
deliberately not implemented. Don't add them speculatively. (The experimental Garmin Connect sync
above is the one deliberate exception — and it is explicitly experimental.)
