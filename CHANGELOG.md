# Changelog

All notable changes to OpenIbex are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the project is pre-1.0, the minor version (`0.MINOR.x`) is bumped for new
capability and the patch version for fixes; breaking changes may land in a minor bump.

> **Workflow:** every code change adds an entry under `[Unreleased]` in the same commit.
> At release time, `[Unreleased]` is cut into a dated, versioned block and the version in
> `package.json` is bumped. Planned work lives in [ROADMAP.md](ROADMAP.md),
> never here.

## [Unreleased]

### Added
- **Garmin bulk import from the web** — **Settings → Import Garmin export** now accepts a full Garmin
  "Export Your Data" archive (`.zip`) and runs the exact same job as the `pnpm import:garmin` CLI: the
  upload is extracted server-side, then discovery, the four-stage de-duplication (file SHA-256 / prior
  upload / Garmin activity id / parsed fingerprint), worker-thread FIT parsing, and smart-title metadata
  all behave identically. The import runs in the background (a full export can take minutes) and the
  request redirects straight to the batch's **Imports** log, where the per-file progress/imported/
  duplicate/failed counts stream in just like a CLI run. Re-uploading the same export is always safe.
  Large archives may require raising `BODY_SIZE_LIMIT` (see [docs/nixos.md](docs/nixos.md)); the CLI is
  unaffected as it reads from disk.
- **NixOS module for bare-metal self-hosting** — the flake now exposes
  `nixosModules.default` (plus `packages.<system>.openibex` and `overlays.default`) so a NixOS host can
  run OpenIbex as a plain systemd service with no Docker, behind your own reverse proxy (Caddy, nginx,
  Traefik, …). The package builds the adapter-node bundle and compiles the native `better-sqlite3`
  against the pinned Node; the module runs it as a dedicated `openibex` system user under
  `/var/lib/openibex`, binds to `127.0.0.1` by default, applies systemd hardening, and auto-generates
  both secrets on first boot (`SESSION_SECRET` and — so the experimental Garmin sync is zero-touch —
  `SYNC_ENCRYPTION_KEY`) into one `0600` file outside the Nix store and separate from the database, so
  a DB-only leak can't decrypt stored tokens. It offers typed options for host/port/origin/
  registration/log level, a `generateSyncEncryptionKey` toggle, an `environmentFile` that overrides the
  generated keys (e.g. from sops-nix/agenix), a `settings` escape hatch for `CALENDAR_*`/
  `BODY_SIZE_LIMIT` knobs, and `openFirewall`. Setup, reverse-proxy guidance, the options reference, and
  the update flow live in [docs/nixos.md](docs/nixos.md).
- **Calendar subscription sync (experimental)** — subscribe to a read-only public ICS feed (e.g. a
  coach-managed team calendar) in Settings → Calendar subscriptions; its events become planned
  workouts on your calendar, editable and deletable like any you create. Title/description/date/
  duration are mapped, the sport is inferred from the text, and planned TSS reuses the existing
  `fallbackLoadScore` heuristic (free-text interval structure is intentionally not parsed yet). Feeds
  are polled opportunistically on page loads, **throttled per subscription** and coordinated through
  the subscription row's own durable lock/throttle/circuit-breaker (the proven `sync_jobs` pattern,
  per-feed) — with conditional fetches (`ETag` / `If-Modified-Since`) so an unchanged feed is a cheap
  304, and an `https`-only **SSRF guard** (rejects loopback/private/link-local/metadata hosts,
  re-checked per redirect) on the user-supplied URL. **Reconciliation** keeps untouched workouts
  auto-updating from the feed while never silently clobbering your edits: an edited workout stops
  auto-updating, and if the coach *also* changes it you get a **conflict** to review on the workout's
  edit page (apply the coach's version or keep yours); a workout you delete stays deleted across
  re-syncs (durable tombstone); and an event removed/cancelled upstream is deleted if untouched or
  kept-and-flagged if you'd customized it. Recurring events (RRULE / RECURRENCE-ID / EXDATE) are
  expanded within a bounded horizon, matching is by iCal UID, parsing is defensive (one malformed
  event can't sink a sync), and each changed poll is logged as a batch on `/imports`.
- **GPS route map on the activity page** — the track is rendered in-app on a `<canvas>` (no tiles,
  no external calls, no map library), colored in short segments by intensity with a
  HR / pace / power / HR-zone toggle (metrics the activity lacks are hidden). It draws on two
  stacked canvas layers that stay crisp across devicePixelRatio / browser-zoom changes — the colored
  track on a base layer redrawn only on data/metric/resize/theme changes, the hover marker on a
  lightweight overlay — so brushing never re-renders the track. The per-point stream
  (lat/lng + HR/pace/power/elevation) is shared by the map and charts and capped at 1800 samples by
  even time sampling (typical activities keep every point), an **elevation profile** sits below the
  HR/pace chart, and a single shared hovered-point store **brushes** the map and both charts in
  either direction. The HR/pace chart has a **moving ⟷ elapsed** time toggle (default moving): moving
  excludes paused time for a clean Strava/intervals-style line, elapsed plots wall-clock and marks
  paused stretches as shaded gap bands. Indoor activities show a tidy "No GPS data" state.
- **Continuous integration** (GitHub Actions) — typecheck (`pnpm check`), test, and build; a
  changelog-touched gate on PRs; and a `docker compose` health smoke test against `/api/health`.
- **Git pre-commit hook** — tracked in `.githooks/`, auto-wired via the `prepare` script; runs
  `pnpm check` + `pnpm test` before each commit.
- **Claude Code commit guard** — a `PreToolUse` hook (`.claude/`) that blocks the agent from
  committing on `main` or with failing tests.

### Changed
- **Fonts are self-hosted (Fontsource) instead of loaded from Google Fonts.** The Google Fonts
  `<link>` + `preconnect`s in `app.html` are gone; Archivo and JetBrains Mono now ship from the
  app's own origin via `@fontsource/*`, imported in the root layout. Only the **latin subset** and
  the **weights actually used** (400/500/600/700) are bundled, served **woff2-first** with
  `font-display: swap`, and the two highest-impact first-paint faces (Archivo 400 body + Archivo 600
  UI) are **preloaded**. Removes a third-party request/dependency on every page load (better for
  privacy and for the mobile-over-Tailscale path), at the cost of a few hundred KB of font files in
  the build.
- **Per-activity stream metrics are precomputed at import, not re-parsed on every page load.** The
  dashboard's time-in-zone + power-profile aggregation previously decompressed and parsed every
  in-window stream blob on each load (~240 ms of event-loop-blocking work for ~55 activities, and
  growing with training volume). Each activity's HR histogram (seconds per bpm) and mean-maximal
  power curve are now computed once when the FIT records are already in memory at import and stored
  in a new `activity_stream_metrics` table (versioned, `ON DELETE CASCADE`); the dashboard reads and
  sums these in one indexed query — flat O(activities), no stream reads. The HR data is stored as a
  histogram (not pre-bucketed zones) so changing your max HR re-buckets at read time with no
  recompute, and the power curve keeps a richer duration set for a future power-duration chart. A
  metrics row that's missing or from an older algorithm version is **lazily recomputed and persisted
  on read**, so a fresh clone works before any backfill and auto-heals across version bumps. Backfill
  existing activities with `pnpm metrics:rebuild --user you@example.com`.
- **`/activities` ships a much smaller payload.** The page still loads the full activity set and
  filters/sorts/paginates client-side, but each row now carries only raw fields (11, down from ~20):
  the duplicated `searchText` (a full lowercased copy of title + description) and every precomputed
  display string (`date`, distance/duration/IF/HR labels, the IF bar width, per-row sport `tag`/
  `color`) are gone. Labels are derived in the browser from the raw values, and the sport display
  maps moved to a client-importable `$lib/sport.ts`. This is the biggest bytes-over-the-wire win on
  the mobile-over-Tailscale path and scales with history size. Filter/sort behavior is unchanged
  (the component precomputes a `searchText`/`distanceDisplay` once per load, so the per-keystroke
  filter stays a tight numeric pass).
- **`docker compose up -d --build` is now a true one-line setup.** A root entrypoint chowns the
  `/data` bind-mount to the target user (configurable via `PUID`/`PGID`, default `1000`) then drops
  privileges with `gosu`, so a host user whose uid isn't 1000 no longer hits an EACCES on first
  write — no manual `chown` needed.
- **Production Docker image no longer ships the dev dependency tree.** The build stage runs
  `pnpm prune --prod` before the runtime stage copies `node_modules`, dropping ~100 MB+ of build-only
  packages (typescript, drizzle-kit, svelte-check, vitest, tsx). `svelte` and `vite` were moved from
  `dependencies` to `devDependencies` (adapter-node bundles the app, so neither is needed at runtime).
- **`planned_workouts` gets a `(user_id, scheduled_date)` index** matching the calendar and
  analytics-range query shape (previously a per-user table scan).
- **Garmin sync (experimental) is harder to wedge.** All Garmin network calls now have a 30 s
  timeout, so a hung request can't leave a sync run holding its lock and critical-work slot until the
  process restarts. The per-user sync lock is refreshed on a heartbeat as each activity is processed
  (and release/renew are guarded by the owning instance), so a long first-run backfill that exceeds
  the lock TTL no longer lets a concurrent auto-sync start a second run.

### Removed
- **The `/analytics` page and the `daily_metrics` cache are gone.** The page was an unused remnant
  and the cache was write-only (nothing read it), so both were dead weight. They also computed daily
  training load a *different* way than the dashboard (dropping the IF-based tier), which made the two
  surfaces disagree on the same numbers. The dashboard EWMA is now the single PMC code path. Removes
  the `daily_metrics` table (migration `0014`), its repository/service, the `pnpm analytics:rebuild`
  CLI, and the dead route/API code.

### Fixed
- **A missing or rotated `SYNC_ENCRYPTION_KEY` now fails loudly instead of silently.** If stored
  Garmin credentials exist but can't be decrypted with the current key (key missing, changed, or
  rotated), the app logs a clear error at startup explaining sync will keep failing and how to fix it
  — instead of sync quietly dropping into a perpetual backoff with no actionable signal. The check is
  log-only (never crashes the app over an experimental feature) and runs alongside the existing
  boot-time key-format validation.
- **Dashboard "Time in zone" and "Power profile" cards now show real data** — both were hardcoded
  placeholders. They are now aggregated from the per-activity HR/power streams over the dashboard's
  84-day (12-week) window. *Time in zone* buckets every HR sample into Z1–Z5 as a percentage of total
  HR time, using the athlete's configured max HR when set and each activity's own max otherwise.
  *Power profile* is a mean-maximal curve — the best rolling-average watts at 5 s / 1 min / 5 min /
  20 min plus FTP (the configured value, else ≈95% of the best 20 min). Both degrade gracefully:
  athletes with no power meter see a clear "no power data" state instead of invented wattages, and an
  HR-less period shows an empty zone card rather than fake percentages.
- **Activity pages for GPS-less activities (pool swims, indoor trainer rides)** — these pages were
  inert: the HR/pace chart rendered but couldn't be hovered or toggled between Moving/Elapsed, and
  links changed the URL without navigating. The route map's `onMount` called `getContext` on its
  canvas unconditionally, but that canvas only exists when the activity has GPS — so for a GPS-less
  activity it threw on `undefined`, and an unhandled `onMount` throw aborts the whole page's
  hydration (dead controls + broken client-side routing). `onMount` now bails when the canvases
  aren't present.
- **Dark mode on iOS/Safari PWA** — the status-bar / browser-chrome strip no longer stays light when
  the theme is dark. The `<meta theme-color>` is now removed and re-appended on each theme change
  (iOS Safari won't repaint the bar when an existing tag's `content` is mutated in place), and the
  `<body>`/`<html>` background is painted to match the theme so the installed PWA's translucent
  status-bar region (which shows the page behind it, ignoring theme-color) tracks light/dark.
- **Touch scrubbing on the activity charts** — the HR/pace and elevation charts now follow a finger
  dragged smoothly across them instead of only responding to discrete taps. They use Pointer Events
  with `touch-action: pan-y` (vertical page scroll still works) and pointer capture, replacing the
  mouse-only `mousemove` handler.

## [0.2.0] - 2026-06-24

Live (experimental) Garmin Connect sync, a broad production-hardening pass, a full UI redesign, and the activities filtering workflow.

### Added
- **Experimental Garmin Connect sync** — opt-in, logs in via the unofficial `garmin-connect`
  library, auto-syncs new activities on page load (throttled to once per 15 minutes) plus a
  manual *Sync now*. Session tokens are encrypted at rest (`SYNC_ENCRYPTION_KEY`). No
  background worker; no MFA.
- **Full UI redesign** — design system (tokens, palette, typography), cockpit-style app shell,
  and redesigned Dashboard, Calendar, Activities (list + detail), and Analytics.
- **Activities filtering** — client-side search, range filters, and column sorting over the
  full activity set.
- **User preferences** — per-user thresholds (FTP / threshold HR) and units (imperial default),
  applied app-wide.
- **Smart activity titles** — derive titles from Garmin metadata, falling back to
  `"TimeOfDay Sport"` instead of raw file basenames.
- **Richer health endpoint** — `/api/health` now reports DB ping, in-flight write count, and
  failing-sync count; wired into the Docker `HEALTHCHECK`.
- **Structured logging** — `pino` JSON logs with credential redaction.
- **Dependency scanning** — Dependabot config and a `pnpm audit` script.
- **PWA / mobile** — installable PWA polish, responsive layouts, mobile bottom tab bar.

### Changed
- **Durable sync coordination** — sync lock + throttle + circuit breaker (exponential backoff)
  moved from an in-memory map into the `sync_jobs` table, so they survive restarts and
  coordinate across processes/tabs. Honest sync status is surfaced in the app shell.
- **FIT parsing isolation** — parsing runs in a worker thread with a parse-time deadline and a
  bounded record cap, protecting the event loop from large or crafted files.
- **SQLite hardening** — full pragma set (WAL, `foreign_keys=ON`, `busy_timeout`, cache/temp
  tuning) with a FK-enforcement test.
- **Graceful shutdown** — on `SIGTERM`, drain in-flight writes, checkpoint the WAL, and close
  the DB cleanly; Docker runs non-root with a stop grace period.
- **Transactional imports** — the `activity_file` and `activity` rows commit atomically.
- **Boot-time config validation** — fail fast on missing/invalid secrets.
- **Dependencies** — `drizzle-orm` upgraded `0.36 → 0.45.2`; `garmin-connect` pinned to `1.6.2`.
- **Navigation** — removed the Settings subnav; added an Imports link to the main sidebar.
- **Bloat reduction** — deduped sport/date/percent helpers, dropped a dead UI library,
  extracted a shared `SummaryCard`, unified sport tags, and deleted dead code.

### Fixed
- Bound FIT stream size to prevent event-loop hangs on crafted files.
- Reject non-activity FIT files at import; add a cleanup script for ghost activities.
- Settings form bindings now accept input (`$:` → `let`).
- Equal calendar day-column widths regardless of title length.
- FIT parser robustness corpus (activity variants + malformed input).

### Security
- Upgrade `drizzle-orm` to remediate a SQL-injection advisory.
- Override `shell-quote` to the patched `>=1.8.4`.
- Encrypt stored Garmin session tokens; redact credentials from logs and error messages.
- Set `ORIGIN` in `docker-compose.yml` so form POSTs pass SvelteKit's CSRF check.

## [0.1.0] - 2026-05-21

Foundation release (milestones 0–7): a working self-hosted training platform.

### Added
- **Accounts & sessions** — registration/login with SHA-256-hashed session tokens; the first
  registered user becomes admin; further registration gated by `OPEN_REGISTRATION`.
- **FIT upload** — upload FIT files; parse into activities with gzip-compressed time-series
  streams.
- **Offline Garmin bulk import** — a CLI (`pnpm import:garmin`) that walks a Garmin data export,
  recursively unzips, dedupes by SHA-256, and records per-file failures without aborting the
  batch (results at `/imports`). No Garmin API or credentials.
- **Activities** — list and detail views.
- **Calendar & planning** — planned workouts and automatic matching of planned↔completed pairs
  (`workout_links`).
- **Analytics** — training load, fitness/fatigue/freshness, weekly totals, and compliance over
  any date range; optional `daily_metrics` cache.
- **Data export & backup** — generate a full export of user data.
- **Deployment** — single-container Docker image, SQLite (WAL) with migrations applied
  automatically on startup.

[Unreleased]: https://github.com/notusknot/openibex/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/notusknot/openibex/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/notusknot/openibex/releases/tag/v0.1.0
