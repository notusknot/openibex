# OpenIbex

A self-hosted training platform for endurance athletes.

Milestone 0 status: greenfield scaffold (SvelteKit + SQLite + Drizzle) with a public health endpoint.

## Tech stack (Milestone 0)

- SvelteKit + TypeScript (`@sveltejs/adapter-node`)
- SQLite-first (`/data/openibex.db`)
- Drizzle ORM + Drizzle Kit migrations
- pnpm
- Single-container Docker Compose deployment (bind-mount `./data` to `/data`)

## Local development

### Option A: Nix devshell (recommended for this repo)

```bash
direnv allow
pnpm install
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
pnpm dev
```

If `/api/health` 500s with a `better-sqlite3` “Could not locate the bindings file” error, native build scripts likely didn’t run. This repo is configured to allow pnpm to build `better-sqlite3`; reinstall/rebuild:

```bash
pnpm rebuild better-sqlite3
```

## Database and migrations

This project uses Drizzle ORM with Drizzle Kit migrations.

Common commands:

```bash
pnpm db:generate
pnpm db:migrate
```

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
docker compose up -d --build
curl -s http://localhost:3000/api/health
```

Data lives in `./data` on the host and is mounted to `/data` in the container.

## Notes

- Milestone 0 intentionally does **not** implement auth, uploads/import, activities, analytics, or coach features yet.
- The codebase is structured so that routes call services, services call repositories, and repositories are the only layer that touches Drizzle/SQLite (to preserve the future “Go API later” path).
