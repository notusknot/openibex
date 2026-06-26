# Roadmap

> **This file holds only what is planned.** When a feature is completed, it moves out of here and
> into [CHANGELOG.md](CHANGELOG.md). Never record completion state in this file — there are
> no "done" checkboxes here. Anything completed lives in the changelog, not here.

Items are grouped by theme, not committed to a release or a date. Domain formulas referenced
below are defined in [docs/DOMAIN.md](docs/DOMAIN.md).

## Analytics & domain

- **Per-sport PMC** — separate CTL/ATL/TSB for swim, bike, and run rather than a single
  blended curve, so load in one discipline doesn't mask freshness in another.
- **Swim load via CSS** — Critical Swim Speed–based load, and a per-sport threshold trio
  (CSS for swim, Critical Speed for run, FTP for bike) feeding intensity.
- **Wellness / HRV ingestion + readiness** — take in morning wellness/HRV and blend it with
  TSB into a single readiness signal.
- **Brick / transition analytics** — detect and analyze back-to-back disciplines (e.g. bike→run)
  as a unit.
- **Forward-TSB calendar projection** — project fitness/fatigue/form forward over planned
  workouts so the calendar shows where form is heading.

## Product features

- **Per-workout fueling** — recommended carbohydrate and electrolyte targets by workout
  duration and intensity.
- **Route recommendations** — suggest routes based on history and target workout.
- **Activities bulk edit** — multi-select on the activities page to edit/delete in bulk.
- **Web Garmin bulk import** — drive the existing offline bulk importer from the web UI instead of only the CLI.
- **Native mobile app** — beyond the current installable PWA.

## Hardening & operations

- **Litestream backups** — continuous SQLite replication to object storage for point-in-time
  recovery, documented for self-hosters.
- Open items carried from the production-readiness backlog (see
  [docs/archive/production-readiness.md](docs/archive/production-readiness.md) for the original
  Wave-2/3 list).

---

## Ideas / unprioritized (maintainer suggestions)

Not committed work — candidates for the lists above, included for discussion.

### Code health & hardening

- **Background sync worker** — sync currently fires only on page load (15-min throttle, no
  background worker). A DB-backed job runner would decouple sync from user traffic and enable
  periodic auto-refresh; the `sync_jobs` lock + circuit breaker are already in place.
- **End-to-end / integration tests** — Playwright coverage of the critical paths (register →
  login → FIT upload → activity appears; Garmin connect → sync). Today's suite is unit/service
  level only.
- **Auth abuse protection** — rate-limiting / backoff on `/login` and `/register` for
  brute-force and registration-spam resistance.
- **Optional ESLint + Prettier** — `pnpm check` (svelte-check) is the only static gate today; a
  lint/format toolchain becomes worthwhile if the codebase grows or gains outside contributors.
- **Activity-list virtualization** — client-side filtering over the full set is intentional; if
  histories grow large, add windowing rather than server pagination.
- **Go API extraction groundwork** — the routes→services→repositories layering exists to keep a
  future Go API possible; a tracked stub for when/if that boundary is actually cut.

### New features

- **Power/HR zones + time-in-zone** — per activity and rolled up over a period, derived from the
  per-user thresholds already stored.
- **Personal records & power curve** — best-efforts (e.g. best 5k / best 20-min power), a
  mean-max power curve, and threshold history over time.
- **Map / route view** — render the GPS track from stored stream records; an all-routes heatmap
  is a natural follow-on.
- **Structured workout builder + execution view** — `planned_workouts.structure_json` already
  exists; author interval structure and compare planned-vs-actual per interval.
- **Activity comparison** — overlay two activities (pace / power / HR) side by side.

### Fixes

 - Fix docker compose up one-time deploy on new system
 - Fix time in zone and power meter on dashboard
 - Improve nav performance
 - Improve planned workout UI
 
