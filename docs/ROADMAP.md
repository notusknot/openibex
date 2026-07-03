# Roadmap

> **This file holds only what is planned.** When a feature is completed, it moves out of here and
> into [CHANGELOG.md](CHANGELOG.md). Never record completion state in this file — there are
> no "done" checkboxes here. Anything completed lives in the changelog, not here.

## How this list is ordered

OpenIbex is a **personal tool first** — built to be battle-tested in daily use, which is also the
cheapest path to a shareable product later. So the list is ordered by *what daily use needs next*,
not by how interesting an item is to build.

Daily use has a specific shape: a collegiate athlete whose training structure comes from a
coach-run team calendar (already syncing in via ICS). The plan is fixed; the daily decision is
**how hard to go in today's fixed session**, and the point of it all is **being ready for races**.
The near-term priority is therefore the self-coaching feedback loop from Friel's *Training Bible* —
readiness in the morning, reflection after the workout, race-aware guidance in between — not
planning tools, which the team calendar already provides.

- **Now** — the Friel daily loop, plus the remaining daily-use friction.
- **Next** — candidate features to go deep on; daily use decides which one, and in what order.
- **Later** — product-tax and bigger bets, pulled forward only when earned (showing the app to
  others, or a feature the Now/Next loop proves out).
- **Not now** — deliberately deferred until a one-user tool actually needs them.

Domain formulas referenced below are defined in [docs/DOMAIN.md](docs/DOMAIN.md).

---

## Now

The daily self-coaching loop: about a minute of input a day, and the app answers the one question
the team calendar can't — *how hard should I go today, given the race I'm building toward?*

- **Morning check-in + "how hard today?" verdict** — a sub-15-second daily form (sleep, soreness,
  mood, motivation on 1–5; optional resting HR / HRV) with rolling personal baselines, blended with
  the TSB/readiness KPI the dashboard already computes into one daily recommendation. Friel's
  morning-warnings decision rules: two or more out-of-baseline indicators (or one extreme) → "make
  today easy — sit in, slower lane, cut it short"; warnings on two consecutive days → "take a real
  rest day." A new `wellness` table plus a pure, unit-tested rules module (the `lthrTest.ts`
  pattern). This absorbs the former "Wellness / HRV ingestion + readiness" bet from Later — for an
  athlete whose only daily lever is intensity, it is the single highest-value feature in the app.
- **Races with A/B/C priority + taper guidance** — first-class race entries (date, distance,
  priority; max 3 A-races, per Friel), a dashboard countdown to the next A race, and passive
  race-proximity nudges: A race → 2–3-week taper (volume down 30–50% per week, keep intensity);
  B race → easy 2–3 days prior; C race → "treat it as a workout, no taper." Includes a **day-after
  race debrief** prompt (deliberately not race-day — emotions confuse the analysis): what worked,
  what didn't, pacing notes. The app exists to help train for races and currently has no concept of
  one.
- **Post-workout micro-debrief (RPE + grade + note)** — three taps on the activity detail page:
  session RPE (0–10), an A–F "did it do its job?" grade, one line of feeling. The unused `comments`
  table already fits. RPE doubles as a load fallback for swim/strength where no IF exists, and the
  accumulated grades/notes are the data that later personalizes the morning verdict (which warning
  signs actually precede *your* bad days). Friel's diary-not-log, in its minimum form.
- **Week intensity strip + density guardrails** — zero new input: classify each of the last 7 days
  hard/easy from data already stored (IF, time-in-zone, load) and render a compact strip on the
  dashboard. Warn on Friel's rules: more than 2 hard days in a week (the 5-2 pattern), hard days
  <48 h apart, and hard sessions inside a pre-race taper window. The honesty check for team weeks
  that quietly become four hard days.
- **Mobile / Tailscale performance — remainder** — compression (gzip/brotli), nav-tab preloading,
  the rail-summary cache, and the `/activities` payload trim have shipped; still open: HTTP/2 in
  front of `adapter-node`, and trimming the activity-detail stream payload (~119 KB).
- **Reconfirm calendar streaming** — the instant-transition treatment (`{#await}` + skeleton) was
  applied to the activities list, activity detail, *and* the calendar. The calendar's month payload
  is light, so the skeleton flash may not be worth it there. Test on the prod box; if it doesn't
  clearly help, revert **just** the calendar page (`src/routes/(app)/calendar/+page.server.ts` +
  `+page.svelte`, folding `CalendarView.svelte` back in) to a blocking `await`, keeping activities +
  detail streamed.

## Next

Candidate features to deepen. Not commitments — pick from these as daily use reveals which one you
keep wishing existed. The first three complete the Friel loop once the Now items exist.

- **Intent tags on synced team workouts** — one field on a planned workout: intended intensity
  (hard / easy / race-sim), inferred from the ICS event text with a manual override on the workout
  edit page. Crossed with the morning check-in this produces the app's signature output: *"Today:
  team track intervals (hard). Readiness low and Thursday is also hard — recommend sitting in."*
  Builds directly on the calendar-sync mapping layer; staged after the check-in and week strip
  exist.
- **Threshold upkeep + EF trend** — flag a stale FTP when the rolling 20-min power best (already
  stored per activity in `activity_stream_metrics`) drifts from `ftpWatts`; wire up the unused
  `thresholdPaceSecPerKm` for run zones; retest reminders (~every 6–8 weeks, suggested during easy
  weeks); and an Efficiency Factor trend (NP ÷ avg HR on steady rides, NGP ÷ avg HR on steady runs)
  as the aerobic-fitness line. Keeps every derived number honest.
- **Weekly review ritual** — a once-a-week, two-minute prompt built on the micro-debrief data:
  Friel's standing questions (progress toward the race? training too hard or too easy? enough
  recovery? still enjoying it?), answered in a line or two next to the race countdown.
- **Per-sport HR zones (LTHR per discipline)** — HR zones are currently anchored on a single LTHR
  (`thresholdHrBpm`), which is a *run/bike* threshold. Swim HR runs ~10–15 bpm lower for the same
  effort (horizontal position, cooler water, dive reflex, smaller working-muscle mass), so one
  threshold can't zone all sports — the dashboard time-in-zone card had to exclude swim + strength
  to avoid dumping most of that time into Z1. The fix is a per-sport LTHR (at least run vs bike vs
  swim): store a threshold per discipline, tag the field test with its sport, and pick the zone set
  by the activity's sport. Deferred from the initial LTHR feature because it needs a schema change,
  a per-sport test flow (the 30-min TT taken once per discipline), and per-activity zone selection
  on the aggregate card — a ~2× scope for a single-athlete MVP. Pairs naturally with the swim CSS /
  per-sport threshold trio below.
- **Swim load via CSS** — Critical Swim Speed–based load, and a per-sport threshold trio (CSS for
  swim, Critical Speed for run, FTP for bike) feeding intensity.
- **Personal records & power curve** — best-efforts (e.g. best 5k / best 20-min power), a mean-max
  power curve, and threshold history over time.
- **Power/HR zones + time-in-zone** — per activity and rolled up over a period, extending the
  dashboard cards already shipped, derived from the per-user thresholds already stored.
- **Forward-TSB calendar projection** — project fitness/fatigue/form forward over planned workouts
  so the calendar shows where form is heading. Promoted from Later because it pairs directly with
  races + taper guidance: does the plan actually land you fresh on race day?
- **All-routes heatmap** — render an aggregate heatmap from stored stream records; a follow-on to the
  per-activity GPS map.
- **Activities bulk edit** — multi-select on the activities page to edit/delete in bulk.
- **Structured workout builder + execution view** — `planned_workouts.structure_json` already exists;
  author interval structure and compare planned-vs-actual per interval. Demoted rather than promoted:
  session structure arrives from the team calendar, so this only earns its keep for self-authored
  race-specific sessions. (Promote when you actually run structured sessions.)
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
- **Auth abuse protection** — rate-limiting / backoff on `/login` and `/register` for brute-force and
  registration-spam resistance.
- **Background sync worker** — sync currently fires only on page load (15-min throttle, no worker). A
  DB-backed job runner would decouple sync from user traffic and enable periodic auto-refresh; the
  `sync_jobs` lock + circuit breaker are already in place.

### Deeper analytics bets — promote into Next when daily use justifies it

- **Per-sport PMC** — separate CTL/ATL/TSB for swim, bike, and run rather than a single blended
  curve, so load in one discipline doesn't mask freshness in another.
- **Brick / transition analytics** — detect and analyze back-to-back disciplines (e.g. bike→run) as a
  unit.
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
