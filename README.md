# OpenIbex

A self-hosted training platform for endurance athletes.

This repo currently implements Milestones 0–6 from `openibex_sveltekit_prd.md` (auth, planning, FIT import, calendar matching, analytics, and data export).

## Tech stack

- SvelteKit + TypeScript (`@sveltejs/adapter-node`)
- SQLite-first (`/data/openibex.db`)
- Drizzle ORM + Drizzle Kit migrations
- pnpm
- Single-container Docker Compose deployment (bind-mount `./data` to `/data`)

## Quickstart (Docker Compose)

```bash
cp .env.example .env
```

Set a strong `SESSION_SECRET` (required in production):

```bash
python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
```

Paste that value into `.env` as `SESSION_SECRET=...`.

Then run:

```bash
docker compose up -d --build
curl -s http://localhost:3000/api/health
```

Open the app:

- `http://localhost:3000/register` (first user becomes `admin`)

If you want to allow multiple users, set `OPEN_REGISTRATION=true` in `.env` (default is `false`).

## Local development

### Option A: Nix devshell (recommended for this repo)

```bash
direnv allow
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

### Option B: Node + pnpm

Requirements:

- Node.js 20+ (this repo’s flake uses Node 22)
- pnpm 10+
- SQLite dev tools are optional (only needed for inspecting DB)

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

If `/api/health` 500s with a `better-sqlite3` “Could not locate the bindings file” error, native build scripts likely didn’t run. This repo is configured to allow pnpm to build `better-sqlite3`; reinstall/rebuild:

```bash
pnpm rebuild better-sqlite3
```

## Tests

```bash
pnpm test
```

## Database and migrations

This project uses Drizzle ORM with Drizzle Kit migrations.

Common commands:

```bash
pnpm db:generate
pnpm db:migrate
```

Migrations are also applied automatically on server startup (so the container can self-initialize), but `pnpm db:migrate` is still the recommended workflow during development.

## Authentication (Milestone 1)

- Visit `http://localhost:3000/register` to create the first account (first user becomes `admin`).
- After the first user, registration is disabled by default unless `OPEN_REGISTRATION=true`.

Auth-related env vars:

- `SESSION_SECRET` (required in production, 16+ chars; use a long random value)
- `SESSION_TTL_DAYS` (default `30`)
- `OPEN_REGISTRATION` (default `false`)

## Planned workouts + calendar (Milestone 2)

- Create planned workouts at `http://localhost:3000/calendar/new`
- View them on the month calendar at `http://localhost:3000/calendar`

## FIT upload + activities (Milestone 3)

- Upload a FIT file at `http://localhost:3000/activities/upload`
- View activities at `http://localhost:3000/activities`
- Download the original uploaded file from an activity detail page

On disk (Docker bind-mount `./data` to `/data`):

- Raw uploads: `./data/uploads/<userId>/<sha256>.fit`
- Stream blobs: `./data/streams/<activityId>.json.gz`

## Calendar matching (Milestone 4)

- The calendar shows both planned workouts and completed activities.
- Auto-matching links planned+completed by date and sport (one-to-one).
- Manual link/unlink is available from the planned workout edit page.

## Analytics (Milestone 5)

- Analytics UI: `http://localhost:3000/analytics`
- JSON endpoint: `http://localhost:3000/api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Formulas: `docs/analytics.md`

## Data export + backup (Milestone 6)

- Generate an export at `http://localhost:3000/settings/export`
- Back up and restore: `docs/self-hosting.md`

## Health endpoint

Public endpoint:

```bash
curl -s http://localhost:3000/api/health
```

Expected response:

```json
{ "ok": true }
```

## Docker Compose (single container)

```bash
cp .env.example .env
# Edit .env and set SESSION_SECRET before running in production.
docker compose up -d --build
curl -s http://localhost:3000/api/health
```

Data lives in `./data` on the host and is mounted to `/data` in the container.

## Reset local dev data

Stop the app, then remove the SQLite database file:

```bash
rm -f ./data/openibex.db ./data/openibex.db-*
```

## Security/deployment notes

- Set a strong `SESSION_SECRET` and run behind HTTPS in production.
- Back up the host `./data` directory (Docker bind mount persists `/data`).

## Notes

- OpenIbex intentionally does **not** implement GPX/TCX import, external integrations, OAuth, or coach workflows yet.
- The codebase is structured so that routes call services, services call repositories, and repositories are the only layer that touches Drizzle/SQLite (to preserve the future “Go API later” path).
