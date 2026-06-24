> ⚠️ **ARCHIVED — NOT AUTHORITATIVE.** Historical snapshot, kept for context. It may describe plans that shipped, changed, or were dropped. For current state see `CHANGELOG.md` (shipped) and `ROADMAP.md` (planned); for how the system works now see `docs/ARCHITECTURE.md` and `docs/DOMAIN.md`. Do not treat anything below as current.

# OpenIbex — Production Readiness Checklist

Tracks the work to take OpenIbex from "works on my machine" to an app users trust with years of training history and personal health data (HRV, sleep, resting HR). Ordered roughly by severity. Check items off as they land; each is scoped to be a single PR or small group of PRs.

Priority key: 🔴 critical (data loss / security / correctness) · 🟠 high (reliability / trust) · 🟡 medium (hygiene / polish)

---

## 1. Data safety (SQLite + backups)

- [x] 🔴 Enable **WAL mode** (`PRAGMA journal_mode = WAL`) on every connection / at startup.
- [x] 🔴 Enable **`PRAGMA foreign_keys = ON`** — OFF by default in SQLite, per-connection. Without it, FK constraints are silently ignored.
- [x] 🔴 Set **`PRAGMA busy_timeout = 5000`** so concurrent writes wait instead of throwing `SQLITE_BUSY` (your auto-sync-on-page-load makes contention real).
- [x] 🔴 Set **`PRAGMA synchronous = NORMAL`** (correct durability/speed balance under WAL).
- [ ] 🔴 **Litestream** continuous backup to S3-compatible storage, and **test a restore** end-to-end (an untested backup is not a backup).
- [ ] 🔴 **Versioned migrations only** — Drizzle migration files applied transactionally on boot; forbid `drizzle-kit push` in prod.
- [ ] 🟠 Wrap the **FIT import pipeline in a transaction** (activity row + streams + dedup atomic; crash mid-import leaves nothing half-written).
- [ ] 🟠 Wrap **wellness upserts** the same way.
- [x] 🔴 **Graceful shutdown** on SIGTERM: stop new sync work, finish in-flight writes, checkpoint WAL, `db.close()`. (Docker sends SIGTERM on every deploy/restart.)
- [ ] 🟡 Periodic `PRAGMA wal_checkpoint(TRUNCATE)` (or rely on Litestream's checkpointing) so the WAL file doesn't grow unbounded.
- [ ] 🟡 Periodic `PRAGMA optimize` / occasional `ANALYZE` for query planner health.

## 2. Correctness (the numbers must be true)

- [ ] 🔴 **Unit tests for all training math**: TSS, IF, NP, CTL/ATL/TSB, monotony/strain, decoupling, GAP, CSS/FTP/eFTP estimation. Pure functions, known-input→known-output.
- [ ] 🔴 **FIT-parser fixture corpus** in CI: no-HR, no-power, multisport+transitions, paused/resumed, indoor/no-GPS, corrupt/truncated, different vendors.
- [ ] 🟠 **Strict TypeScript** (`strict: true`); no `any` at data boundaries.
- [ ] 🟠 **Validate external data** (Garmin JSON, FIT-derived) into typed shapes (Zod or equivalent) before use; never trust shape.
- [ ] 🟡 Golden-file tests: parse a known activity, assert the full derived summary.
- [ ] 🟡 Document/centralize each formula with its source so values are auditable (also a user-trust feature).

## 3. Garmin sync reliability (your #1 fragility)

- [x] 🔴 **DB-backed sync job + lock** replacing the in-memory throttle/in-flight map (survives restarts, safe across processes/tabs). *(spec'd below)*
- [ ] 🟠 **Circuit breaker + exponential backoff** on Garmin failures/429s (failure mode can be an account ban — never retry tightly).
- [ ] 🟠 **Graceful degradation**: dashboard / calendar / activities render fully when sync is down or has never run.
- [ ] 🟠 **Honest sync status in UI**: last-synced time, "syncing", "failing", "reconnect needed".
- [ ] 🟠 **Alert on elevated sync-failure rate** (know before users do when Garmin changes an endpoint).
- [ ] 🟡 Pin the unofficial `garmin-connect` library to an exact version; review every bump deliberately.

## 4. Security & privacy (health data raises the stakes)

- [ ] 🔴 **IDOR audit**: every query scoped to the authenticated user; every `/{id}` route verifies ownership. Go route-by-route.
- [ ] 🔴 **Boot-time config validation, fail fast**: assert `SYNC_ENCRYPTION_KEY` present + valid 32-byte base64, and all required env vars, at startup.
- [ ] 🔴 **Password hashing** with Argon2id (or bcrypt); never anything home-rolled.
- [ ] 🟠 **Login rate limiting** / lockout / backoff.
- [ ] 🟠 **Cookie hardening**: `httpOnly` + `secure` + `sameSite`; session invalidation on password change.
- [ ] 🟠 **Confirm CSRF protection** active on all form actions.
- [ ] 🟠 **Upload/parse hardening**: cap FIT size, validate type, treat parser as hostile-input; can't hang event loop or crash process.
- [ ] 🟠 **Account deletion + full data export** that actually purges FIT files + streams from disk, not just a flag.
- [ ] 🟡 **Security headers** (CSP, HSTS, X-Content-Type-Options) via a hooks handler.
- [ ] 🟡 **Dependency scanning** (`npm audit` / Dependabot / Renovate) in CI.
- [ ] 🟡 Confirm the credential **redactor** sits in the logging path so tokens/passwords never reach logs.

## 5. Observability

- [ ] 🟠 **Structured logging** (pino) with levels; redactor in-path; replace `console.log`.
- [ ] 🟠 **Error tracking** (Sentry or similar), server + client, with context.
- [ ] 🟠 **`/health` endpoint**: DB connectivity + last-successful-sync age; wire to Docker `HEALTHCHECK`.
- [ ] 🟡 **Key metrics**: sync success rate, FIT parse-failure rate, import latency (even logged counters).

## 6. Frontend resilience

- [ ] 🟠 **Error boundaries** so one render error doesn't white-screen the app.
- [ ] 🟠 **Explicit empty / loading / error states**, especially new-user-no-data and the three sync states.
- [ ] 🟡 **Progressive enhancement** via form actions (core flows work without JS).
- [ ] 🟡 **Accessibility**: keyboard nav, focus management, ARIA on charts/controls, contrast on **both** themes.
- [ ] 🟡 Loading skeletons / optimistic UI where it reduces perceived latency.

## 7. Operations & release hygiene

- [ ] 🟠 **Dockerfile**: multi-stage build, **non-root user**, `HEALTHCHECK`, correct signal handling (pairs with §1 graceful shutdown).
- [ ] 🟠 **CI on every PR**: typecheck, lint, test suite (math + parser fixtures), `npm audit`.
- [ ] 🟡 **Committed lockfile**, reproducible builds.
- [ ] 🟡 **Versioning / release process** (changelog, tags).
- [ ] 🟡 **Docs**: README, self-host guide, **backup/restore runbook**, env-var reference, architecture overview.
- [ ] 🟡 `.env.example` listing every required variable.

---

## Suggested sequencing

**Wave 1 — stop catastrophes (do first):**
SQLite pragmas (§1) · Litestream + tested restore (§1) · graceful shutdown (§1) · IDOR audit (§4) · boot-time config validation (§4) · DB-backed sync job (§3).

**Wave 2 — earn trust:**
Training-math tests + FIT fixtures (§2) · circuit breaker + visible sync status (§3) · structured logging + error tracking + `/health` (§5) · transactional imports (§1).

**Wave 3 — polish & hygiene:**
Frontend states + error boundaries (§6) · security headers + dependency scanning (§4) · Docker hardening + CI (§7) · docs (§7).

> The three items spec'd in `stability-hardening-spec.md` (SQLite pragmas, graceful shutdown, DB-backed sync job) are the Wave-1 backend core.
