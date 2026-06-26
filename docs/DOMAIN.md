# Domain model & invariants

The durable source of truth for what the numbers mean and what the data guarantees are.
Formulas here describe how OpenIbex computes things. They are deliberately simple and transparent,
not proprietary. When the code and this doc disagree, fix one of them.

Implementation lives in `src/lib/server/services/analytics/` (load + analytics page) and
`src/lib/server/services/dashboardService.ts` (the cockpit dashboard).

## Training load (TSS)

Per-activity load is "best available TSS", chosen in priority order (`analytics/load.ts`,
`loadFor`):

1. **Stored `loadScore`** if present and > 0 (e.g. Garmin-precomputed training load).
2. **IF-based TSS** when we can compute an intensity factor: `hours × IF² × 100`.
3. **Sport-factor fallback** from duration alone: `hours × sportFactor × 100`.

where `hours = durationSec / 3600`.

**Intensity factor (IF)** (`intensityFactorFor`):
- **Bike** → `power / FTP` (normalized-power-like value if available, else average power).
- **Run** → `avgHr / thresholdHr`.
- **Swim / Strength / Other** → no IF (falls through to the sport-factor fallback).

**Sport factors** (used by the fallback):

| Sport | factor |
|---|---:|
| Bike | 0.60 |
| Run | 0.70 |
| Swim | 0.65 |
| Strength | 0.50 |
| Other | 0.50 |

**Thresholds** are per-user (`ftpWatts`, `thresholdHrBpm`); when unset, defaults are
**FTP = 240 W** and **threshold HR = 160 bpm**.

## Performance Management Chart: Fitness / Fatigue / Form

`daily_load` = sum of per-activity load on that local calendar day. From the daily series the
**dashboard (`/dashboard`, the cockpit)** derives three values via an **EWMA** over an 84-day
window, seeded at 0:

```text
aC = 1 − e^(−1/42)      aA = 1 − e^(−1/7)
CTL (Fitness) += (daily_load − CTL) × aC     # 42-day time constant
ATL (Fatigue) += (daily_load − ATL) × aA     # 7-day  time constant
TSB (Form)     = CTL − ATL
```

This is the single PMC path. (A separate `/analytics` page once computed a second, rolling-average
variant from a `daily_metrics` cache; both were removed — the page was an unused remnant and the
two-formula split was a needless source of "why don't the numbers match." If a smoothed historical
series is wanted later, add it back deliberately, not as a parallel truth.)

### Derived dashboard signals (with the exact bands)

The dashboard's KPI bands are **coaching heuristics, tunable in `buildKpiIndicators`** — not hard
science. Current thresholds:

- **Ramp** = ΔCTL over the last 7 days. Fitness status: `≥8 Spiking`, `≥3 Building`,
  `>−2 Steady`, `>−6 Easing`, else `Detraining`.
- **Fatigue** status from the `ATL/CTL` ratio: `<0.7 Low`, `≤1.1 Normal`, `≤1.4 High`,
  else `Very high`.
- **Form (TSB)** status: `>20 Peaked`, `≥8 Fresh`, `≥−10 Balanced`, `≥−25 Fatigued`,
  else `Overreached` (marker scaled on a −30…+30 track).
- **Week TSS** = Σ daily load over the last 7 days, judged against a sustainable load ≈ `CTL × 7`.
- **Monotony** = `mean / sd` of the last 7 daily loads; **Strain** = `Σload₇ × monotony`.
- **Readiness** = `clamp(round(50 + TSB × 1.6), 3, 100)`, labelled `≥78 Race-ready`,
  `≥60 Fresh`, `≥42 Productive`, `≥26 Fatigued`, else `Overreached`. (Note: this readiness label
  is a *separate* scale from the Form/TSB bands above — don't conflate the two.)

## Compliance

- **Compliance** is computed per **linked** planned↔completed pair (`workout_links`), surfaced on
  the activity detail and calendar views:
  ```text
  duration_compliance = completed_duration / planned_duration   (etc. for distance, load)
  ```
  If the planned value is 0 or missing, that compliance ratio shows as `—`.

## Deduplication guarantees (3 layers)

Across all three ingestion paths (upload, live sync, bulk import), an activity is deduped by, in
order of cost:

1. **Garmin activity id** (`sourceActivityId`) — cheapest; skips before downloading.
2. **FIT bytes SHA-256** (`sourceFileSha256` / `activity_files.sha256`) — exact content match
   across sync, upload, and export. Re-importing the same export is a no-op.
3. **Fingerprint** — `sport + startTime + duration + distance`, applied after parse as a final
   guard against the same activity arriving via different files.

## Data-model invariants

- `activities.source` ∈ `{ garmin-sync, garmin-export, upload }` — provenance is never lost.
- `parserVersion` is stored per activity so re-parsing/backfills are detectable.
- **Sync cursor** = `garmin_credentials.lastSyncAt` (epoch ms of the newest imported activity);
  the live sync only pulls activities newer than this.
- **`sync_jobs`** is the single durable record of per-user sync state: lock (owner + timestamp),
  throttle, consecutive-failure count, and circuit-breaker cooldown. One row per user.
- **Streams** are stored at `data/streams/<activityId>.json.gz`; `activities.streamPath` holds the
  relative path. Streams are bounded at parse time (record cap) to keep blobs sane.
- Bulk imports record **per-file** outcomes in `import_items` (discovered/imported/duplicate/
  unsupported/failed) under an `import_batches` row; one bad file never aborts the batch.

## Glossary

- **CTL / Fitness** — chronic training load; long-term (42d) load trend.
- **ATL / Fatigue** — acute training load; short-term (7d) load.
- **TSB / Form / Freshness** — training stress balance, `CTL − ATL`.
- **TSS / Load** — training stress score; our per-activity load number.
- **IF** — intensity factor (effort relative to threshold).
- **Ramp** — rate of CTL change (build rate).
- **Monotony / Strain** — Foster's training-monotony and -strain measures.
- **CSS / Critical Speed** — swim/run threshold-pace analogues (planned; see ROADMAP).
