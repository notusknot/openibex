# Roadmap

> **This file holds only what is planned.** When a feature is completed, it moves out of here and
> into [CHANGELOG.md](CHANGELOG.md). Never record completion state in this file — there are
> no "done" checkboxes here. Anything completed lives in the changelog, not here.

## How this list is ordered

OpenIbex is a **personal tool first** — built to be battle-tested in daily use, which is also the
cheapest path to a shareable product later. So the list is ordered by *what daily use needs next*,
not by how interesting an item is to build:

- **Now** — remove the friction in daily use, so the tool gets used enough to reveal what matters.
- **Next** — candidate features to go deep on; daily use decides which one, and in what order.
- **Later** — product-tax and bigger bets, pulled forward only when earned (showing the app to
  others, or a feature the Now/Next loop proves out).
- **Not now** — deliberately deferred until a one-user tool actually needs them.

Domain formulas referenced below are defined in [docs/DOMAIN.md](docs/DOMAIN.md).

---

## Now

The two things that make daily use frictionless enough to generate signal.

- **Mobile / Tailscale performance** — real usage is an iPhone over Tailscale, and the bottleneck is
  bytes-over-wire, not compute. Put gzip/brotli + HTTP/2 in front of `adapter-node` (it serves
  responses uncompressed over HTTP/1.1 today), decouple the rail summary (`getRailSummary()`, an
  84-day load) from blocking every navigation, eager-preload the nav rail for touch (hover-preload is
  a no-op on a phone), and trim the `/activities` (~98 KB) and activity-detail stream (~119 KB)
  payloads.
- **Trust the numbers** — keep the dashboard-accuracy work going, and reconcile (or at least clearly
  label) the **two PMC code paths**: the dashboard's EWMA and the analytics page's rolling average
  currently make "Fitness" read as two different numbers on two pages. See [docs/DOMAIN.md](docs/DOMAIN.md).

## Next

Candidate features to deepen. Not commitments — pick from these as daily use reveals which one you
keep wishing existed.

- **Power/HR zones + time-in-zone** — per activity and rolled up over a period, extending the
  dashboard cards already shipped, derived from the per-user thresholds already stored.
- **Personal records & power curve** — best-efforts (e.g. best 5k / best 20-min power), a mean-max
  power curve, and threshold history over time.
- **Swim load via CSS** — Critical Swim Speed–based load, and a per-sport threshold trio (CSS for
  swim, Critical Speed for run, FTP for bike) feeding intensity.
- **Activity comparison** — overlay two activities (pace / power / HR) side by side.
- **All-routes heatmap** — render an aggregate heatmap from stored stream records; a follow-on to the
  per-activity GPS map.
- **Activities bulk edit** — multi-select on the activities page to edit/delete in bulk.
- **Structured workout builder + execution view** — `planned_workouts.structure_json` already exists;
  author interval structure and compare planned-vs-actual per interval. (Promote when you actually run
  structured sessions.)
- **Improve the planned-workout UI.**

## Later

Earned, not now.

### Graduation gate — pull forward when showing the app to others

These serve someone *other* than you. They become priority the day you decide to let another person
run it; until then they're paying product tax with no users to benefit.

- **Fix `docker compose up` first-run on a fresh machine** — one-time deploy on a new system must
  work, or the self-host story dies at step one.
- **Litestream backups** — continuous SQLite replication to object storage for point-in-time
  recovery; the one ops item that protects your *own* data. Documented for self-hosters.
- **End-to-end / integration tests** — Playwright coverage of the critical paths (register → login →
  FIT upload → activity appears; Garmin connect → sync). Today's suite is unit/service level only.
- **Web Garmin bulk import** — drive the existing offline bulk importer from the web UI instead of
  only the CLI.
- **Auth abuse protection** — rate-limiting / backoff on `/login` and `/register` for brute-force and
  registration-spam resistance.
- **Background sync worker** — sync currently fires only on page load (15-min throttle, no worker). A
  DB-backed job runner would decouple sync from user traffic and enable periodic auto-refresh; the
  `sync_jobs` lock + circuit breaker are already in place.

### Deeper analytics bets — promote into Next when daily use justifies it

- **Per-sport PMC** — separate CTL/ATL/TSB for swim, bike, and run rather than a single blended
  curve, so load in one discipline doesn't mask freshness in another.
- **Wellness / HRV ingestion + readiness** — take in morning wellness/HRV and blend it with TSB into
  a single readiness signal.
- **Brick / transition analytics** — detect and analyze back-to-back disciplines (e.g. bike→run) as a
  unit.
- **Forward-TSB calendar projection** — project fitness/fatigue/form forward over planned workouts so
  the calendar shows where form is heading.
- **Per-workout fueling** — recommended carbohydrate and electrolyte targets by workout duration and
  intensity.
- **Route recommendations** — suggest routes based on history and target workout.

## Not now

Deliberately deferred until a one-user tool actually needs them.

- **Native mobile app** — the installable PWA is enough for a single user.
- **Go API extraction groundwork** — the routes→services→repositories layering keeps a future Go API
  possible; don't cut that boundary speculatively.
- **Optional ESLint + Prettier** — `pnpm check` (svelte-check) is the only static gate today; a
  lint/format toolchain becomes worthwhile if the codebase grows or gains outside contributors.
- **Activity-list virtualization** — client-side filtering over the full set is intentional; if
  histories grow large, add windowing rather than server pagination.
