# Product Requirements Document: OpenIbex

**Version:** 0.2 draft  
**Date:** 2026-05-21  
**Primary audience:** Codex or another coding agent building the project  
**Product type:** Free and open-source, self-hostable endurance training web app  
**Starting stack:** SvelteKit + SQLite + Drizzle ORM  
**Future target:** SvelteKit frontend + custom Go API, without forcing that split at the beginning

---

## 0. How to use this PRD

This PRD is intended to be handed to Codex milestone-by-milestone. Do not ask Codex to build everything at once.

The project should start as a single SvelteKit full-stack application backed by SQLite and Drizzle. The code must be organized so that a future custom Go API can replace the current server-side SvelteKit data/service layer without requiring a full frontend rewrite.

The most important architectural rule is:

> UI code must not call the database directly. SvelteKit routes and form actions call service functions; service functions call repository functions; repository functions use Drizzle/SQLite. Later, repository/service calls can be replaced by calls to a Go API.

---

## 1. Founder decisions worksheet

Edit the `Current answer` column before giving this PRD to Codex. If left unchanged, Codex should treat the defaults as final.

| Decision | Current answer | Implementation implication |
|---|---|---|
| Project name | `OpenIbex` | Use `openibex` for package names, Docker service names, database filenames, UI title, and docs unless changed. |
| Product tagline | `A self-hosted training platform for endurance athletes.` | Display in README and landing/auth screens. |
| License | `MIT` | Add LICENSE and package metadata accordingly. |
| First target user | `Solo self-hosted athlete` | v0.1 must prioritize single-user quality before coach workflows. |
| Expected instance size | `1-10 users` | SQLite is the primary database for MVP and v1. Do not add PostgreSQL yet. |
| Primary deployment target | `Linux server or Linux workstation using Docker Compose` | Single Docker container with bind-mounted `/data`. |
| Primary sports | `Bike, Run, Swim, Strength, Other` | Support these sport types in enums/forms. Strength is simple logging only in v0.1. |
| First import format | `FIT` | Implement FIT upload/import first. GPX/TCX later. |
| Initial auth model | `Local email/password` | No OAuth, OIDC, LDAP, or magic links in MVP. |
| Auth library choice | `Better Auth if it works cleanly; otherwise simple custom cookie sessions` | Prefer library, but do not let auth library complexity derail MVP. Keep session-cookie auth. |
| First account behavior | `First registered user becomes admin` | Fresh instance bootstrap flow. Disable open registration after first user unless enabled. |
| Allow open registration | `false by default` | Configurable env var: `OPEN_REGISTRATION=false`. |
| Maps | `Disabled by default unless tile provider is configured` | Avoid outbound map tile requests by default. |
| Units | `User preference: imperial or metric; default imperial` | Store unit preference per user. Internally store SI units where practical. |
| Training-load terminology | `Load, Fitness, Fatigue, Freshness, Compliance` | Avoid proprietary/trademarked metric names in UI. |
| Device integrations | `Manual upload only in MVP` | No Strava/Garmin/Wahoo/Polar/Suunto sync yet. |
| Structured workout export | `Out of scope for v0.1` | v0.1 may store planned workout notes/basic structure but does not export to devices. |
| Coach features | `v1.0, not v0.1` | Include role fields and schema seams, but do not build full coach dashboard in v0.1. |
| Future backend direction | `Custom Go API later` | Keep domain logic behind service/repository boundaries and avoid SvelteKit-only assumptions in core models. |
| Public internet readiness | `Private home-server first` | Secure basics, but do not overbuild enterprise controls in v0.1. |
| Telemetry | `None` | No analytics, tracking, or external calls without explicit configuration. |
| Data export | `Required in v0.1` | Export original files plus JSON/CSV metadata. |

### Additional founder notes

Add project-specific preferences here:

```text
Founder notes:
- 
```

---

## 2. Executive summary

OpenIbex is a free and open-source, self-hostable training platform for endurance athletes and small coach/athlete groups. It lets users upload activity files, view completed workouts on a calendar, plan future workouts, compare planned vs. completed training, track training load, and export their data.

The first version must be simple, useful, and self-hostable. It should not try to clone every commercial training platform feature. The first magic moment is:

> Upload a FIT file, parse it, and see the completed activity on a training calendar with useful summary metrics.

The app starts as a SvelteKit full-stack application with SQLite and Drizzle. This keeps the codebase small and deployment simple while allowing a future migration toward a separate Go API.

---

## 3. Product vision

OpenIbex should become the open, self-hosted endurance training home base.

A user should be able to:

1. Own their raw training data.
2. Upload common activity files.
3. Plan workouts on a calendar.
4. Review training trends without needing a subscription SaaS account.
5. Add coach/athlete collaboration later without moving platforms.
6. Export everything.

The product should feel practical, reliable, fast, and boring in a good way. Correctness, transparency, and data ownership matter more than flashy features.

---

## 4. Goals and non-goals

### 4.1 Goals for v0.1

1. Run locally or on a private server using Docker Compose.
2. Use a single SvelteKit app container.
3. Use SQLite as the primary database.
4. Use Drizzle ORM and Drizzle migrations.
5. Allow a first admin user to register and complete onboarding.
6. Support local email/password authentication with secure password storage and session cookies.
7. Upload a FIT file and parse it into activity summary data.
8. Store original uploaded activity files on disk.
9. Store parsed activity streams on disk, not as one database row per sample.
10. Display completed activities on a calendar.
11. Create and edit planned workouts.
12. Compare planned vs. completed workouts at a basic level.
13. Display basic analytics: volume, distance, elevation, load, fitness, fatigue, freshness, and compliance.
14. Allow notes/comments on activities and planned workouts.
15. Export all user data and original files.
16. Keep route/service/repository boundaries clear enough to support a future Go API.

### 4.2 Goals for v1.0

1. Add coach and athlete roles in the UI.
2. Add invite-based coach/athlete relationships.
3. Add coach dashboard and athlete list.
4. Add workout library and reusable workout templates.
5. Add GPX and TCX import.
6. Add structured workout builder.
7. Add better charts for time in zones and power/pace/heart-rate curves.
8. Add admin tools for user management, backup checks, and import diagnostics.
9. Improve import pipeline with an import-job queue if synchronous import becomes too slow.
10. Prepare API boundaries for a future custom Go backend.

### 4.3 Non-goals for v0.1

1. Native mobile apps.
2. Electron or Tauri desktop app.
3. Garmin, Strava, Wahoo, Polar, Suunto, Zwift, or TrainingPeaks direct sync.
4. Payment processing.
5. Coach marketplace.
6. Public social feed.
7. AI training plans or AI coaching.
8. Medical advice, injury diagnosis, or automated prescriptions.
9. Full replacement for advanced desktop analysis tools.
10. Proprietary API scraping.
11. Separate Go API in the initial build.
12. PostgreSQL in the initial build.
13. Redis, Celery, BullMQ, or another background worker system in the initial build.

---

## 5. Target users and personas

### 5.1 Solo self-hosted athlete

**Profile:** Linux user, cyclist/runner/triathlete, comfortable with Docker Compose.  
**Needs:** Own data, upload workouts, see calendar and trends, plan future training.  
**Pain:** Does not want a subscription or closed platform.  
**Success:** Can replace a spreadsheet and basic commercial training log.

### 5.2 Small coach or advisor

**Profile:** Coaches a few athletes, may be technical or may rely on a hosted instance run by someone else.  
**Needs:** See athlete calendars, leave comments, assign workouts, track compliance.  
**Pain:** Commercial tools are expensive or lock in data.  
**Success:** Can manage a small roster from one dashboard.

### 5.3 Data-oriented endurance athlete

**Profile:** Interested in training load, zones, trends, and historical comparisons.  
**Needs:** Accurate parsing, transparent formulas, exportability, reproducible metrics.  
**Pain:** Black-box analytics and limited exports.  
**Success:** Understands how metrics are calculated and can export raw data.

### 5.4 Project maintainer/contributor

**Profile:** Developer contributing parsers, charts, integrations, or deployment improvements.  
**Needs:** Clear architecture, tests, issue breakdown, contribution docs.  
**Pain:** Messy undocumented code.  
**Success:** Can add a parser or chart without breaking the app.

---

## 6. Technical strategy

### 6.1 Starting architecture

OpenIbex starts as a single full-stack SvelteKit app:

```text
Browser
  -> SvelteKit routes/pages/actions/endpoints
    -> service layer
      -> repository layer
        -> Drizzle ORM
          -> SQLite database at /data/openibex.db
    -> local filesystem storage at /data/uploads and /data/streams
```

### 6.2 Future architecture

The desired future architecture is:

```text
Browser
  -> SvelteKit frontend
    -> typed API client
      -> custom Go API
        -> SQLite or PostgreSQL
        -> local filesystem or object storage
```

The initial implementation must avoid blocking this future split.

### 6.3 Key architectural rules

1. Svelte components must not import server-only database modules.
2. Page server files and route endpoints must call service functions, not raw Drizzle queries.
3. Service functions may enforce business rules.
4. Repository functions are the only place that should use Drizzle query APIs directly.
5. Database schema should be explicit, stable, and well-named.
6. Routes should avoid embedding business logic.
7. File parsing should be isolated behind import services.
8. Store raw files separately from relational metadata.
9. Do not store activity stream samples as individual database rows in v0.1.
10. Use tests around services/repositories so they can survive the future Go transition.

### 6.4 Why this stack

SvelteKit provides full-stack routing, server-side rendering, form actions, server endpoints, and an adapter model suitable for self-hosted Node deployment. Drizzle provides a TypeScript-first ORM and migration workflow for SQLite. SQLite is appropriate for the expected 1-10 user self-hosted instance size. The stack avoids the complexity of a separate frontend/backend split until the product has earned it.

---

## 7. Required technology choices

### 7.1 Runtime and framework

- SvelteKit
- Svelte
- TypeScript
- Node runtime
- `@sveltejs/adapter-node`

### 7.2 Database

- SQLite
- Drizzle ORM
- Drizzle Kit migrations
- Preferred driver: `better-sqlite3`

Default database path:

```text
/data/openibex.db
```

Default environment variable:

```text
DATABASE_URL=file:/data/openibex.db
```

SQLite requirements:

- Enable WAL mode.
- Enable foreign keys.
- Keep transactions short.
- Avoid long-running writes during parsing.
- Use migrations from the beginning.
- Do not add PostgreSQL for v0.1.

### 7.3 Auth

Preferred:

- Better Auth with Drizzle adapter and email/password auth.

Fallback:

- Custom session-cookie auth using secure password hashing.

Auth requirements regardless of library:

- Email/password login.
- Secure password hashing.
- HTTP-only secure session cookies where applicable.
- CSRF-safe form handling.
- First user becomes admin.
- Registration disabled by default after first user unless `OPEN_REGISTRATION=true`.
- Roles: `athlete`, `coach`, `admin`.
- Coach role exists in schema but coach workflows are out of scope for v0.1.

### 7.4 Styling/UI

Preferred:

- Plain Svelte components.
- Tailwind CSS or a simple CSS system.
- No heavy component framework unless Codex has a strong reason.

UI should be functional, clean, and low-friction. Do not overinvest in visual design during early milestones.

### 7.5 Charts and calendar

Recommended:

- Charts: Chart.js, Apache ECharts, or LayerCake.
- Calendar: FullCalendar, or a simple custom calendar first.

Implementation guidance:

- A simple custom month/week calendar is acceptable for v0.1 if FullCalendar adds too much complexity.
- Use JSON endpoints for chart/calendar data where useful.
- Do not block core workflows on a perfect drag/drop calendar.

### 7.6 File parsing

v0.1 requires FIT import.

Preferred path:

- Use a maintained JavaScript/TypeScript FIT parser if suitable.

Fallback path:

- Add an isolated Python or Go parser subprocess later, but do not introduce a separate API service solely for parsing in v0.1.

Parser requirements:

- Original uploaded file must be preserved.
- Duplicate uploads detected by SHA-256 hash.
- Failed parsing must be recorded and shown to the user.
- Parsed streams must be stored as compressed JSON or another simple stream blob format on disk.
- Activity summaries must be stored in SQLite.

### 7.7 Deployment

- Single Docker container for v0.1.
- Docker Compose for local/self-hosted deployment.
- Bind mount `./data:/data`.
- No database container.
- No Redis container.
- No object storage container.

Example runtime shape:

```text
openibex-app
  /data/openibex.db
  /data/uploads/
  /data/streams/
  /data/exports/
```

---

## 8. Repository structure

Codex should generate a monorepo-like but single-app structure:

```text
openibex/
  README.md
  LICENSE
  package.json
  pnpm-lock.yaml
  svelte.config.js
  vite.config.ts
  tsconfig.json
  drizzle.config.ts
  Dockerfile
  docker-compose.yml
  .env.example
  .gitignore

  src/
    app.d.ts
    app.html
    hooks.server.ts

    routes/
      +layout.svelte
      +layout.server.ts
      +page.svelte
      login/
        +page.svelte
        +page.server.ts
      register/
        +page.svelte
        +page.server.ts
      dashboard/
        +page.svelte
        +page.server.ts
      calendar/
        +page.svelte
        +page.server.ts
      activities/
        +page.svelte
        +page.server.ts
        upload/
          +page.svelte
          +page.server.ts
        [activityId]/
          +page.svelte
          +page.server.ts
      planning/
        +page.svelte
        +page.server.ts
        [plannedWorkoutId]/
          +page.svelte
          +page.server.ts
      analytics/
        +page.svelte
        +page.server.ts
      settings/
        +page.svelte
        +page.server.ts
        export/
          +page.svelte
          +page.server.ts
      api/
        health/
          +server.ts
        calendar/
          +server.ts
        activities/
          [activityId]/
            streams/
              +server.ts
        analytics/
          load/
            +server.ts

    lib/
      components/
        AppShell.svelte
        Nav.svelte
        EmptyState.svelte
        MetricCard.svelte
        CalendarView.svelte
        ActivitySummaryCard.svelte
        PlannedWorkoutForm.svelte
        ChartPanel.svelte
      server/
        config.ts
        db/
          client.ts
          schema.ts
          migrate.ts
        auth/
          auth.ts
          sessions.ts
          guards.ts
        repositories/
          users.ts
          sessions.ts
          activities.ts
          plannedWorkouts.ts
          comments.ts
          zones.ts
          imports.ts
          settings.ts
        services/
          users.ts
          auth.ts
          activities.ts
          importActivity.ts
          planning.ts
          analytics.ts
          exportData.ts
          storage.ts
        parsers/
          fit.ts
        validation/
          auth.ts
          activities.ts
          planning.ts
          settings.ts
      shared/
        types.ts
        units.ts
        dates.ts
        sports.ts

  drizzle/
    migrations/

  tests/
    unit/
    integration/

  docs/
    architecture.md
    self-hosting.md
    data-model.md
    analytics.md
    future-go-api.md
```

---

## 9. Data storage strategy

### 9.1 SQLite stores

SQLite stores structured relational metadata:

- users
- sessions/auth records
- athlete profiles
- user settings
- activities
- activity files
- planned workouts
- comments/notes
- zones
- import jobs
- activity/planned workout links
- computed daily/weekly metrics

### 9.2 Filesystem stores

The filesystem stores raw and large blob data:

```text
/data/uploads/{userId}/{sha256}.fit
/data/streams/{activityId}.json.gz
/data/exports/{exportId}/...
```

Rules:

- Never discard the original uploaded file unless the user deletes the activity/file.
- Do not store per-second samples as relational rows in v0.1.
- Keep stream files portable and documented.
- Prefer gzip-compressed JSON for simplicity unless Codex has a strong reason to use another format.

---

## 10. Database schema

The schema below is conceptual. Codex should implement it in Drizzle with SQLite-compatible types and migrations.

### 10.1 users

| Column | Type | Notes |
|---|---|---|
| id | text | UUID or cuid-style string primary key |
| email | text | unique, required |
| display_name | text | nullable |
| role | text | `athlete`, `coach`, `admin`; default `athlete` |
| unit_system | text | `imperial` or `metric`; default from founder worksheet |
| created_at | integer/text | timestamp |
| updated_at | integer/text | timestamp |

If Better Auth owns user tables, add an app profile table keyed to the auth user id rather than fighting the library.

### 10.2 athlete_profiles

| Column | Type | Notes |
|---|---|---|
| id | text | primary key |
| user_id | text | foreign key users.id |
| birth_year | integer | nullable |
| sex | text | nullable; optional profile field |
| weight_kg | real | nullable |
| threshold_hr | integer | nullable |
| threshold_power_w | integer | nullable |
| threshold_pace_sec_per_km | integer | nullable |
| created_at | timestamp | required |
| updated_at | timestamp | required |

Health-sensitive fields must be optional. Do not require them for onboarding.

### 10.3 activity_files

| Column | Type | Notes |
|---|---|---|
| id | text | primary key |
| user_id | text | owner |
| original_filename | text | required |
| file_path | text | required |
| file_type | text | `fit`, later `gpx`, `tcx`, `csv` |
| sha256 | text | unique per user or globally |
| size_bytes | integer | required |
| uploaded_at | timestamp | required |

### 10.4 import_jobs

| Column | Type | Notes |
|---|---|---|
| id | text | primary key |
| user_id | text | owner |
| activity_file_id | text | foreign key |
| status | text | `pending`, `processing`, `succeeded`, `failed` |
| error_message | text | nullable |
| started_at | timestamp | nullable |
| completed_at | timestamp | nullable |
| created_at | timestamp | required |
| updated_at | timestamp | required |

In v0.1, import can be processed immediately during upload, but still create an import job row for visibility and future async processing.

### 10.5 activities

| Column | Type | Notes |
|---|---|---|
| id | text | primary key |
| user_id | text | owner |
| activity_file_id | text | nullable if manually created later |
| sport | text | enum-like |
| title | text | required |
| description | text | nullable |
| start_time | timestamp | required |
| timezone | text | nullable |
| duration_sec | integer | nullable |
| moving_time_sec | integer | nullable |
| distance_m | real | nullable |
| elevation_gain_m | real | nullable |
| avg_hr | real | nullable |
| max_hr | real | nullable |
| avg_power_w | real | nullable |
| max_power_w | real | nullable |
| normalized_power_like_w | real | nullable, avoid proprietary UI naming |
| avg_cadence | real | nullable |
| calories | real | nullable |
| load_score | real | nullable |
| stream_path | text | nullable |
| parser_version | text | nullable |
| created_at | timestamp | required |
| updated_at | timestamp | required |

### 10.6 planned_workouts

| Column | Type | Notes |
|---|---|---|
| id | text | primary key |
| user_id | text | owner |
| sport | text | enum-like |
| scheduled_date | text | local date |
| title | text | required |
| description | text | nullable |
| planned_duration_sec | integer | nullable |
| planned_distance_m | real | nullable |
| planned_load | real | nullable |
| structure_json | text | nullable JSON string |
| created_at | timestamp | required |
| updated_at | timestamp | required |

### 10.7 workout_links

Links completed activities to planned workouts.

| Column | Type | Notes |
|---|---|---|
| id | text | primary key |
| user_id | text | owner |
| activity_id | text | foreign key |
| planned_workout_id | text | foreign key |
| match_type | text | `auto`, `manual` |
| duration_compliance | real | nullable ratio |
| distance_compliance | real | nullable ratio |
| load_compliance | real | nullable ratio |
| created_at | timestamp | required |
| updated_at | timestamp | required |

### 10.8 comments

| Column | Type | Notes |
|---|---|---|
| id | text | primary key |
| user_id | text | author |
| target_type | text | `activity`, `planned_workout` |
| target_id | text | required |
| body | text | required |
| created_at | timestamp | required |
| updated_at | timestamp | required |

### 10.9 zones

| Column | Type | Notes |
|---|---|---|
| id | text | primary key |
| user_id | text | owner |
| sport | text | required |
| zone_type | text | `heart_rate`, `power`, `pace` |
| name | text | required |
| lower_bound | real | nullable |
| upper_bound | real | nullable |
| created_at | timestamp | required |
| updated_at | timestamp | required |

### 10.10 daily_metrics

| Column | Type | Notes |
|---|---|---|
| id | text | primary key |
| user_id | text | owner |
| date | text | local date |
| sport | text | nullable aggregate or sport-specific |
| duration_sec | integer | default 0 |
| distance_m | real | default 0 |
| elevation_gain_m | real | default 0 |
| load_score | real | default 0 |
| fitness | real | nullable |
| fatigue | real | nullable |
| freshness | real | nullable |
| created_at | timestamp | required |
| updated_at | timestamp | required |

### 10.11 app_settings

| Column | Type | Notes |
|---|---|---|
| key | text | primary key |
| value | text | required JSON or string |
| updated_at | timestamp | required |

Use this for instance-level settings such as `open_registration` if not stored solely in env.

---

## 11. Core user journeys

### 11.1 First-run setup

1. User clones repo.
2. User copies `.env.example` to `.env`.
3. User runs `docker compose up -d --build`.
4. User opens `http://localhost:8080`.
5. App detects no users exist.
6. User creates first account.
7. First account becomes admin.
8. User completes simple profile/preferences setup.
9. User lands on empty dashboard/calendar.

Acceptance criteria:

- Fresh instance can start with Docker Compose.
- First user becomes admin.
- Registration is closed after first user unless configured.
- No outbound telemetry occurs.
- User can access the app locally.

### 11.2 Login/logout

1. User opens login page.
2. User enters email/password.
3. App creates a secure session.
4. User sees dashboard.
5. User can logout.

Acceptance criteria:

- Invalid login shows safe error message.
- Authenticated pages redirect unauthenticated users to login.
- Login/register pages redirect authenticated users to dashboard.
- Session persists across browser refresh.

### 11.3 Upload and view an activity

1. User opens upload page.
2. User selects a `.fit` file.
3. App validates file extension and size.
4. App computes SHA-256 hash.
5. App stores original file under `/data/uploads`.
6. App creates an import job row.
7. App parses the file.
8. App stores summary in SQLite.
9. App stores streams under `/data/streams`.
10. App marks import job succeeded or failed.
11. Activity appears on calendar.
12. User opens activity detail page.

Acceptance criteria:

- Duplicate file upload is detected.
- Failed parse shows a human-readable error.
- Original file can be downloaded by owner.
- Parsed activity has sport, start time, duration, distance when available.
- Activity detail shows available summary metrics.

### 11.4 Plan a workout

1. User opens calendar.
2. User clicks a date.
3. User creates planned workout.
4. User chooses sport, title, duration, distance/load, and notes.
5. Workout appears on calendar.
6. User edits or deletes workout.

Acceptance criteria:

- Planned workouts can be created, edited, and deleted.
- Planned workouts and completed activities are separate entities.
- Calendar visually distinguishes planned and completed items.

### 11.5 Compare planned vs. completed

1. User has a planned workout and completed activity on same date/sport.
2. App suggests a match.
3. User can confirm, change, or remove the match.
4. App displays compliance: duration, distance, and load comparison.

Acceptance criteria:

- Auto-match uses date and sport.
- User can manually link/unlink.
- Compliance is visible on detail page and calendar.
- Compliance calculation is documented.

### 11.6 View analytics

1. User opens Analytics page.
2. User chooses date range and sport filter.
3. User sees weekly volume, distance, elevation, and load.
4. User sees fitness/fatigue/freshness chart.
5. User can inspect formula notes.

Acceptance criteria:

- Empty state explains what data is needed.
- Units respect user preference.
- Analytics page works with small datasets.
- Formulas are transparent in docs.

### 11.7 Export data

1. User opens Settings > Data Export.
2. User requests export.
3. App generates export archive.
4. User downloads archive.

Acceptance criteria:

- Export includes JSON metadata.
- Export includes original uploaded files.
- Export includes planned workouts.
- Export includes comments/notes.
- Export can be generated without external services.

---

## 12. Functional requirements

### 12.1 Authentication and user management

- Register first admin.
- Login with email/password.
- Logout.
- View current user.
- Edit display name.
- Edit unit system.
- Admin can view basic user list in v1.0, not required in v0.1.

### 12.2 Dashboard

Dashboard v0.1 should show:

- Welcome/profile summary.
- This week duration.
- This week distance.
- Recent activities.
- Upcoming planned workouts.
- Upload call-to-action.

### 12.3 Calendar

Calendar v0.1 should show:

- Month view or week view.
- Completed activities.
- Planned workouts.
- Basic color by sport.
- Link to detail pages.
- Create planned workout from date.

Drag/drop is nice-to-have, not required for the first calendar milestone.

### 12.4 Activity upload/import

- Accept `.fit` files.
- Reject unsupported file types.
- Enforce configurable max upload size.
- Store original file.
- Parse summary.
- Store stream file.
- Create activity record.
- Show import status.
- Detect duplicates.

### 12.5 Activity detail

Show:

- Title.
- Sport.
- Date/time.
- Duration.
- Distance.
- Elevation gain.
- Heart rate metrics if available.
- Power metrics if available.
- Cadence metrics if available.
- Load score if calculable.
- Comments/notes.
- Link/download original file.
- Charts if stream data exists.
- Map only if location data and map provider configured.

### 12.6 Planned workouts

- Create/edit/delete planned workout.
- Sport.
- Date.
- Title.
- Description.
- Planned duration.
- Planned distance.
- Planned load.
- Optional simple structure JSON.

### 12.7 Analytics

v0.1 analytics:

- Weekly duration.
- Weekly distance.
- Weekly elevation.
- Weekly load.
- Fitness/fatigue/freshness using simple exponentially weighted averages.
- Planned vs completed totals.
- Compliance percentages.

Terminology:

- Use `Load`, not proprietary acronyms.
- Use `Fitness`, `Fatigue`, `Freshness` generically.
- Document formulas clearly.

### 12.8 Comments/notes

- Add note/comment to activity.
- Add note/comment to planned workout.
- Edit/delete own notes.
- In v1.0, coaches can comment on assigned athletes.

### 12.9 Settings

- Profile display name.
- Unit system.
- Data export.
- Instance info.
- Later: zones, thresholds, backup status.

---

## 13. Non-functional requirements

### 13.1 Self-hosting

- Must run with Docker Compose.
- Must work with bind-mounted `/data` directory.
- Must not require external services.
- Must not require root inside container unless unavoidable.
- Must provide clear backup instructions.

### 13.2 Privacy

- No telemetry.
- No analytics scripts.
- No external map tile requests unless configured.
- No external integrations in v0.1.
- User data export required.

### 13.3 Performance

Target scale:

- 1-10 users per instance.
- Thousands of activities per user.
- Original files stored on disk.
- Stream blobs stored on disk.
- SQLite stores summaries and metadata.

Performance targets:

- Dashboard loads in under 1 second for typical self-hosted instance.
- Calendar loads in under 1 second for one year of activities.
- Activity detail loads summary quickly; streams/charts may load separately.
- Upload/import should provide clear feedback if parsing takes more than a few seconds.

### 13.4 Security

- Passwords must be hashed securely.
- Session cookies must be HTTP-only.
- Use secure cookie settings in production.
- Validate file uploads.
- Prevent path traversal.
- Enforce per-user ownership checks.
- Do not expose raw file paths.
- Protect all authenticated pages/routes.
- Keep secrets in environment variables.

### 13.5 Maintainability

- TypeScript strict mode.
- Clear folder boundaries.
- Repository/service architecture.
- Tests for core services.
- Drizzle migrations committed.
- Docs for setup, architecture, data model, and future Go API.

---

## 14. API and route strategy

OpenIbex is not API-first in v0.1, but it should include focused JSON endpoints where useful.

### 14.1 Page routes

- `/` landing or redirect.
- `/login`
- `/register`
- `/dashboard`
- `/calendar`
- `/activities`
- `/activities/upload`
- `/activities/[activityId]`
- `/planning`
- `/planning/[plannedWorkoutId]`
- `/analytics`
- `/settings`
- `/settings/export`

### 14.2 JSON endpoints

- `GET /api/health`
- `GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/activities/[activityId]/streams`
- `GET /api/analytics/load?start=YYYY-MM-DD&end=YYYY-MM-DD&sport=...`

Rules:

- JSON endpoints must enforce auth/ownership.
- Do not expose internal paths.
- Response shapes should be documented in code comments or docs.
- Keep endpoint shapes close to what a future Go API would provide.

---

## 15. Future Go API transition plan

The initial SvelteKit app must be written so a future Go API is a controlled migration, not a rewrite.

### 15.1 Boundaries to preserve

Current:

```text
Svelte page/action
  -> service function
    -> repository function
      -> Drizzle/SQLite
```

Future:

```text
Svelte page/action
  -> API client function
    -> Go API
      -> database/storage
```

### 15.2 Rules for migration readiness

- Define shared domain types in `src/lib/shared/types.ts`.
- Keep request/response shapes explicit.
- Avoid importing Drizzle schema outside repositories/services.
- Do not let UI components depend on database row shapes directly.
- Create mappers from DB rows to domain objects.
- Keep file storage paths behind `storage.ts`.
- Keep parser logic behind `importActivity.ts`.
- Write docs/future-go-api.md explaining candidate endpoints.

### 15.3 Candidate future Go API endpoints

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /activities`
- `POST /activities/upload`
- `GET /activities/{id}`
- `GET /activities/{id}/streams`
- `GET /calendar`
- `POST /planned-workouts`
- `PATCH /planned-workouts/{id}`
- `DELETE /planned-workouts/{id}`
- `GET /analytics/load`
- `POST /exports`
- `GET /exports/{id}/download`

Do not implement the Go API in v0.1.

---

## 16. Analytics definitions

### 16.1 Load score

For v0.1, load score can be calculated simply:

- If power data and threshold power are available, estimate load from intensity and duration.
- If heart-rate data and threshold heart rate are available, estimate load from HR intensity and duration.
- Otherwise, use duration-based fallback.

Fallback formula:

```text
load = duration_hours * default_sport_intensity_factor * 100
```

Example defaults:

| Sport | Default intensity factor |
|---|---:|
| bike | 0.60 |
| run | 0.70 |
| swim | 0.65 |
| strength | 0.50 |
| other | 0.50 |

These are intentionally simple and should be documented as approximations.

### 16.2 Fitness/fatigue/freshness

Use generic rolling/exponential concepts:

```text
fitness = long_window_average_load, default 42 days
fatigue = short_window_average_load, default 7 days
freshness = fitness - fatigue
```

Implementation can use simple rolling averages first. Exponential weighted averages can come later.

### 16.3 Compliance

For a linked planned/completed workout:

```text
duration_compliance = completed_duration / planned_duration
distance_compliance = completed_distance / planned_distance
load_compliance = completed_load / planned_load
```

Cap display ranges for readability but store raw ratios.

Suggested labels:

- Under: < 0.80
- Close: 0.80 to 1.20
- Over: > 1.20

---

## 17. UI requirements

### 17.1 Visual style

- Clean and calm.
- Dense enough for data-heavy use.
- Works well on laptop screens.
- Mobile responsive but not mobile-app-perfect in v0.1.
- Avoid overdesigned marketing UI.

### 17.2 Navigation

Authenticated layout should include:

- Dashboard
- Calendar
- Activities
- Planning
- Analytics
- Settings
- Logout

### 17.3 Empty states

Every primary page needs useful empty states:

- Dashboard: upload first activity or create planned workout.
- Calendar: create planned workout or upload activity.
- Activities: upload FIT file.
- Analytics: upload activities to see trends.
- Settings export: explain what will be included.

### 17.4 Error handling

- Show form-level validation errors.
- Show upload/import errors clearly.
- Log server errors without leaking secrets to UI.
- Provide recovery actions where possible.

---

## 18. Environment variables

`.env.example` must include:

```env
# App
PUBLIC_APP_NAME=OpenIbex
PUBLIC_APP_TAGLINE="A self-hosted training platform for endurance athletes."
NODE_ENV=development
ORIGIN=http://localhost:8080

# Database and storage
DATABASE_URL=file:/data/openibex.db
DATA_DIR=/data
UPLOAD_DIR=/data/uploads
STREAM_DIR=/data/streams
EXPORT_DIR=/data/exports

# Auth
AUTH_SECRET=change-me-generate-a-long-random-secret
OPEN_REGISTRATION=false
SESSION_COOKIE_SECURE=false

# Uploads
MAX_UPLOAD_MB=100

# Maps
MAP_TILE_URL=
MAP_ATTRIBUTION=
```

Production docs must tell users to change `AUTH_SECRET`.

---

## 19. Docker requirements

### 19.1 Docker Compose

`docker-compose.yml` should define one service:

```yaml
services:
  app:
    build: .
    container_name: openibex-app
    ports:
      - "8080:3000"
    env_file:
      - .env
    volumes:
      - ./data:/data
    restart: unless-stopped
```

### 19.2 Dockerfile

Dockerfile should:

- Use a Node base image.
- Install dependencies.
- Build SvelteKit with adapter-node.
- Run migrations on startup or provide a documented migration command.
- Start the Node server.
- Avoid baking user data into image.

Recommended startup behavior:

```text
run migrations
ensure data directories exist
start server
```

---

## 20. Testing requirements

Use a pragmatic test setup.

Required tests for early milestones:

- Unit tests for validation utilities.
- Service tests for user creation/auth behavior.
- Repository tests using temporary SQLite database.
- Import service test using fixture FIT file if available.
- Analytics tests for load/compliance calculations.

Recommended tools:

- Vitest for unit/service tests.
- Playwright later for end-to-end smoke tests.

Initial E2E smoke test goals:

1. Register first user.
2. Login.
3. Create planned workout.
4. Upload fixture activity.
5. See calendar item.
6. Export data.

---

## 21. Milestone plan

### Milestone 0: Greenfield scaffold

Goal: create the new SvelteKit + SQLite + Drizzle foundation.

Scope:

- SvelteKit app with TypeScript.
- `@sveltejs/adapter-node`.
- pnpm.
- Drizzle ORM and Drizzle Kit.
- SQLite database config.
- Dockerfile and Docker Compose.
- `/api/health` endpoint.
- Basic layout shell.
- README with setup instructions.
- `.env.example`.
- Nix flake/devshell optional if owner wants it.

Acceptance criteria:

- `pnpm install` works.
- `pnpm dev` works.
- `pnpm build` works.
- `docker compose up -d --build` works.
- `GET /api/health` returns ok.
- SQLite database file can be created under `/data`.

Suggested Codex prompt:

```text
You are building OpenIbex from the attached PRD. Start Milestone 0 only. Create a greenfield SvelteKit + TypeScript app using adapter-node, SQLite, Drizzle ORM, Drizzle Kit migrations, pnpm, Dockerfile, docker-compose.yml, .env.example, README, and a public /api/health endpoint. Do not implement auth, activities, uploads, or analytics yet. Use the Founder Decisions worksheet as source of truth. Keep the app single-container and SQLite-first.
```

### Milestone 1: Auth and onboarding

Scope:

- Local email/password auth.
- First user becomes admin.
- Registration disabled after first user unless `OPEN_REGISTRATION=true`.
- Login/logout.
- Authenticated app shell.
- Dashboard placeholder.
- Settings profile page.
- User/unit preferences.

Acceptance criteria:

- First user can register.
- User can login/logout.
- Protected pages redirect to login.
- User can edit display name and unit system.
- Tests cover register/login/current user basics.

Suggested Codex prompt:

```text
Milestone 0 is complete. Implement Milestone 1 only: local email/password auth, first-user admin bootstrap, session-cookie login/logout, authenticated layout, dashboard placeholder, and settings/profile page. Use Better Auth with Drizzle if it integrates cleanly; otherwise implement simple secure cookie-session auth. Do not add OAuth, external email, activity upload, or coach features. Preserve service/repository boundaries for future Go API migration.
```

### Milestone 2: Planning basics

Scope:

- Planned workout schema.
- Create/edit/delete planned workouts.
- Calendar page with planned workouts.
- Simple sport filters.

Acceptance criteria:

- User can create planned workout.
- User can edit/delete it.
- Calendar displays planned workouts.
- Ownership checks enforced.

Suggested Codex prompt:

```text
Milestone 1 is complete. Implement Milestone 2 only: planned workout model, repository/service functions, create/edit/delete forms, and a simple calendar view showing planned workouts. Do not implement activity upload yet. Keep UI simple and maintain future Go API boundaries.
```

### Milestone 3: FIT upload and import

Scope:

- Activity file upload.
- SHA-256 duplicate detection.
- FIT parser integration.
- Import job records.
- Activity summary records.
- Stream blob storage.
- Activity list/detail pages.

Acceptance criteria:

- User can upload FIT file.
- Duplicate upload detected.
- Activity appears in activities list.
- Activity detail shows parsed metrics.
- Original file can be downloaded.
- Failed imports show useful errors.

Suggested Codex prompt:

```text
Milestone 2 is complete. Implement Milestone 3 only: FIT file upload, activity file storage, SHA-256 duplicate detection, import_jobs, FIT parsing into activity summaries, stream blob storage, activity list/detail pages, and original file download. Keep parsing isolated behind services/parsers. Do not implement GPX/TCX or external integrations.
```

### Milestone 4: Calendar completed activities and matching

Scope:

- Show completed activities on calendar.
- Auto-match planned/completed by date/sport.
- Manual link/unlink.
- Basic compliance display.

Acceptance criteria:

- Calendar shows planned and completed items.
- User can link activity to planned workout.
- Compliance ratios are calculated.
- Calendar visually shows match status.

Suggested Codex prompt:

```text
Milestone 3 is complete. Implement Milestone 4 only: show completed activities on calendar, add workout_links, auto-match planned/completed workouts by date and sport, allow manual link/unlink, and display basic compliance. Do not implement advanced analytics yet.
```

### Milestone 5: Basic analytics

Scope:

- Weekly volume/distance/elevation/load.
- Fitness/fatigue/freshness.
- Analytics page and JSON endpoint.
- Formula docs.

Acceptance criteria:

- Analytics page renders charts.
- Empty state works.
- Units respected.
- Calculations covered by tests.

Suggested Codex prompt:

```text
Milestone 4 is complete. Implement Milestone 5 only: basic analytics for weekly duration, distance, elevation, load, fitness, fatigue, freshness, and compliance. Add tests for calculations and document formulas in docs/analytics.md. Keep terminology generic and avoid proprietary metric names.
```

### Milestone 6: Data export and backup docs

Scope:

- Export metadata as JSON.
- Export planned workouts as JSON/CSV.
- Include original activity files.
- Export archive download.
- Backup/restore docs.

Acceptance criteria:

- User can generate and download export.
- Export contains activities, planned workouts, comments, settings, and original files.
- README/docs explain backup and restore.

Suggested Codex prompt:

```text
Milestone 5 is complete. Implement Milestone 6 only: data export, archive download, and backup/restore documentation. Export metadata, planned workouts, comments, settings, and original uploaded files. Do not add external integrations.
```

### Milestone 7: Polish and v0.1 release hardening

Scope:

- Error states.
- Empty states.
- Basic accessibility.
- Responsive layout.
- Import diagnostics.
- README cleanup.
- Contributor docs.
- Security review.

Acceptance criteria:

- Fresh install works.
- Core flows work manually.
- Tests pass.
- Docs are enough for self-hosting.
- v0.1 tag can be cut.

Suggested Codex prompt:

```text
Milestone 6 is complete. Implement Milestone 7 release hardening only: improve empty states, error states, responsive layout, accessibility basics, docs, security checks, and install instructions. Do not add new major features.
```

---

## 22. Initial GitHub issues

Create issues like:

```text
[Milestone 0] Create SvelteKit scaffold
[Milestone 0] Add Drizzle SQLite setup
[Milestone 0] Add Docker single-container deployment
[Milestone 0] Add health endpoint
[Milestone 1] Implement auth and first-user bootstrap
[Milestone 1] Add authenticated app shell
[Milestone 1] Add settings/profile page
[Milestone 2] Add planned workout schema
[Milestone 2] Add planned workout CRUD
[Milestone 2] Add simple calendar view
[Milestone 3] Add FIT upload page
[Milestone 3] Add file storage service
[Milestone 3] Add FIT parser service
[Milestone 3] Add activity list/detail pages
[Milestone 4] Add completed activities to calendar
[Milestone 4] Add planned/completed matching
[Milestone 5] Add basic analytics service
[Milestone 5] Add analytics charts
[Milestone 6] Add data export
[Milestone 6] Add backup/restore docs
[Milestone 7] Release hardening
```

---

## 23. Acceptance criteria for v0.1

v0.1 is complete when:

1. A new self-hosted instance starts with Docker Compose.
2. First user can register and becomes admin.
3. User can login/logout.
4. User can create planned workouts.
5. User can upload a FIT file.
6. Uploaded activity appears on activity list.
7. Uploaded activity appears on calendar.
8. User can view activity detail metrics.
9. User can link planned and completed workouts.
10. User can view basic analytics.
11. User can export their data and original files.
12. README explains install, backup, restore, and update basics.
13. No telemetry or external integrations are enabled by default.
14. Tests pass.
15. Code follows service/repository boundaries.

---

## 24. Risks and mitigations

### 24.1 FIT parser quality

Risk: JavaScript FIT parser may be incomplete or awkward.

Mitigation:

- Isolate parser behind `src/lib/server/parsers/fit.ts`.
- Preserve original files.
- Store parser version.
- Add fixture tests.
- Allow future parser replacement with Go or Python without changing UI.

### 24.2 Auth library complexity

Risk: Better Auth integration may create complexity or unwanted schema constraints.

Mitigation:

- Try Better Auth first.
- If it becomes a distraction, implement simple session-cookie auth.
- Keep auth behind `auth` service functions.

### 24.3 SQLite write contention

Risk: Concurrent imports/writes can cause locks.

Mitigation:

- Target 1-10 users.
- Enable WAL mode.
- Keep transactions short.
- Store streams on disk.
- Process one import at a time initially if needed.

### 24.4 Overbuilding analytics

Risk: Too much time spent on complex formulas.

Mitigation:

- Start with simple transparent formulas.
- Avoid proprietary names.
- Add advanced models later.

### 24.5 Future Go migration ignored

Risk: SvelteKit full-stack code becomes tightly coupled to database details.

Mitigation:

- Enforce service/repository boundaries.
- Use domain types and mappers.
- Keep future API docs updated.

---

## 25. Documentation requirements

Required docs:

- `README.md`: install, run, test, build, Docker Compose.
- `docs/architecture.md`: stack, folder structure, boundaries.
- `docs/self-hosting.md`: deployment, updates, reverse proxy notes.
- `docs/data-model.md`: tables and file layout.
- `docs/analytics.md`: formulas and terminology.
- `docs/future-go-api.md`: migration strategy and candidate endpoints.

---

## 26. Development commands

README should define commands similar to:

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm check
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Docker commands:

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f
docker compose down
```

---

## 27. Codex operating rules

When Codex works from this PRD:

1. Build one milestone at a time.
2. Do not introduce services not requested by the milestone.
3. Do not replace SvelteKit with React, Next.js, Django, FastAPI, or PocketBase.
4. Do not add PostgreSQL for v0.1.
5. Do not add Redis for v0.1.
6. Do not add external integrations for v0.1.
7. Keep SQLite as primary database.
8. Use service/repository boundaries.
9. Keep deployment single-container.
10. Update README and docs as code changes.
11. Add or update tests for new domain logic.
12. Prefer simple, working workflows over perfect abstractions.

---

## 28. Source notes

This PRD is based on the chosen project direction: SvelteKit full-stack, SQLite, Drizzle ORM, and future Go API migration. The technical implementation should use current official documentation for SvelteKit, Drizzle, Better Auth, SQLite driver choices, and Docker.

