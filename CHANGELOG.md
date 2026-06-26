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

### Fixed
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
