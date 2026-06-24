> ⚠️ **ARCHIVED — NOT AUTHORITATIVE.** Historical snapshot, kept for context. It may describe plans that shipped, changed, or were dropped. For current state see `CHANGELOG.md` (shipped) and `ROADMAP.md` (planned); for how the system works now see `docs/ARCHITECTURE.md` and `docs/DOMAIN.md`. Do not treat anything below as current.

# OpenIbex PRD Addendum: Milestones 8+

**Purpose:** Extend the existing OpenIbex SvelteKit PRD without rewriting the stable foundation.

**Use with Codex:** Attach both the main PRD and this addendum. Tell Codex: "The main PRD remains source of truth for product goals, architecture, and constraints. This addendum defines the next milestones. Work one milestone at a time."

---

## Addendum operating rules

1. Do not rewrite the whole application.
2. Keep the current SvelteKit + SQLite + Drizzle stack.
3. Keep the service/repository boundary for future Go API migration.
4. Keep existing tests passing before moving to the next milestone.
5. Each milestone should be a separate branch/PR or at least a separate commit series.
6. Avoid pixel-copying TrainingPeaks. Use it as workflow inspiration only; OpenIbex should have its own visual identity.
7. Prefer design-system tokens and reusable components over one-off page styling.
8. Do not introduce external telemetry, external maps, or third-party sync unless explicitly requested.

---

# Milestone 8: UI/UX design system and product redesign brief

## Goal
Create a modern OpenIbex visual direction and design system before changing many pages. The app should feel powerful like an advanced endurance training platform, but cleaner, more modern, and self-hosted-native.

## Required skill usage
Use the `ui-ux-pro-max` skill for this milestone if available in the coding environment.

If using Codex Skills, install the skill first from the project root using the instructions from the skill repository. Then ask Codex to apply it to the OpenIbex UI redesign.

## Design direction
OpenIbex should feel:

- professional
- dense but not cluttered
- data-rich
- modern
- calm
- athletic
- trustworthy
- fast
- self-hosted/power-user friendly

Avoid:

- playful consumer fitness-app styling
- excessive gradients
- copying TrainingPeaks pixel-for-pixel
- hiding important data behind too much whitespace
- fragile one-off styling

## Deliverables

Create or update:

- `docs/design/ui-redesign-brief.md`
- `docs/design/design-system.md`
- `docs/design/page-inventory.md`
- `src/lib/styles/tokens.css` or equivalent
- a minimal set of reusable UI primitives/components

Design system should define:

- color palette
- light and dark mode behavior if supported
- typography scale
- spacing scale
- border radius scale
- elevation/shadow rules
- table density rules
- chart color rules
- sport color mapping
- status/compliance color mapping
- activity-card patterns
- dashboard-card patterns
- form patterns
- empty-state patterns
- loading/error/success states
- responsive behavior

## Pages to audit

Audit all current authenticated pages, including at least:

- dashboard
- calendar
- activities list
- activity detail
- activity edit/create
- imports list
- import detail
- analytics pages if present
- settings/profile

For each page, document:

- purpose
- primary user action
- secondary actions
- data density level
- current UX problems
- redesign notes
- reusable components needed

## Acceptance criteria

- No major functional rewrites are required in this milestone.
- The design direction is documented.
- A component inventory exists.
- Styling tokens are created or planned.
- Codex can use the docs to implement the redesign in later milestones.
- Existing app behavior remains unchanged.
- Existing tests still pass.

## Codex prompt

```text
You are building OpenIbex from the main PRD and Milestones 8+ Addendum.

Start Milestone 8 only: UI/UX design system and product redesign brief.

Use the ui-ux-pro-max skill if it is installed in this coding environment. If the skill is available, apply it specifically to a SvelteKit endurance-training dashboard application. If the skill is not available, proceed using the requirements in this addendum and clearly note that the skill was unavailable.

Do not rewrite the whole UI yet. This milestone is primarily a design-system and audit milestone.

Goals:
- Define a modern, professional, data-rich visual direction for OpenIbex.
- Keep inspiration from TrainingPeaks-level capability, but do not copy TrainingPeaks UI, branding, layout, or visual assets.
- Create reusable design-system documentation and styling tokens for later implementation.

Deliverables:
- docs/design/ui-redesign-brief.md
- docs/design/design-system.md
- docs/design/page-inventory.md
- initial CSS/design tokens in the app if appropriate
- optional small component primitives if low-risk

Constraints:
- Keep SvelteKit + SQLite + Drizzle.
- Do not change backend behavior.
- Do not implement Garmin web upload yet.
- Do not add a Go API.
- Do not add external telemetry.
- Keep existing tests passing.

Acceptance criteria:
- The design docs clearly describe the desired UI direction.
- The app has a documented component/page inventory.
- A future Codex milestone can implement the redesign from these docs.
- Existing functionality still works.
```

---

# Milestone 9: Core UI shell and navigation redesign

## Goal
Implement the visual foundation from Milestone 8 across the authenticated app shell and core navigation without changing business logic.

## Scope

Redesign:

- authenticated app shell
- sidebar/topbar
- user menu/logout area
- responsive navigation
- dashboard placeholder/layout
- shared page header component
- shared card/panel components
- shared button/input/form styling
- table/list styling
- empty states
- loading/error states

## Requirements

- Use Svelte components for reusable UI primitives.
- Keep server-side auth and route protection unchanged.
- Keep current routes unchanged unless there is a strong documented reason.
- Preserve all existing user flows.
- Make the UI feel like a polished training platform, not a generic CRUD app.
- Use dense data layout where appropriate.
- Avoid visual over-decoration.

## Acceptance criteria

- Existing routes still work.
- Authenticated shell looks cohesive and modern.
- Navigation is clear on desktop and usable on mobile/tablet widths.
- UI primitives are reusable and documented.
- Existing tests pass.

## Codex prompt

```text
You are building OpenIbex from the main PRD and Milestones 8+ Addendum.

Milestone 8 is complete. Start Milestone 9 only: core UI shell and navigation redesign.

Use the design docs from Milestone 8 as source of truth. Use ui-ux-pro-max if available for implementation review and quality checks.

Implement the redesigned authenticated app shell, navigation, shared page layout, card/panel styles, buttons, forms, tables/lists, empty states, and loading/error states.

Do not change business logic. Do not change database schema unless absolutely necessary. Do not implement Garmin web upload yet.

Acceptance criteria:
- Existing app routes still work.
- Existing tests pass.
- The UI is cohesive, modern, responsive, and professional.
- Core components are reusable rather than one-off page CSS.
```

---

# Milestone 10: Activities, calendar, analytics UI redesign

## Goal
Apply the new design system to the main product surfaces where athletes spend time: dashboard, calendar, activities, activity detail, and analytics.

## Scope

Redesign:

- dashboard
- activity list
- activity detail
- activity create/edit forms
- calendar page
- analytics/training load pages
- planned/completed comparison UI if present

## Requirements

- Preserve all existing functionality.
- Improve information hierarchy.
- Use sport/status colors consistently.
- Improve mobile/tablet readability.
- Improve chart containers and legends.
- Make activity detail pages feel analytical and useful.
- Make dashboard cards compact but readable.

## Acceptance criteria

- Core athlete workflows feel polished.
- Existing functionality and tests continue to pass.
- No backend redesign is introduced.

## Codex prompt

```text
You are building OpenIbex from the main PRD and Milestones 8+ Addendum.

Milestones 8 and 9 are complete. Start Milestone 10 only: redesign dashboard, calendar, activities, activity detail, and analytics UI using the established design system.

Use ui-ux-pro-max if available to review layout, hierarchy, accessibility, and responsive behavior.

Do not change core business logic. Preserve existing routes and tests. Focus on product quality, information hierarchy, data density, and modern training-platform polish.

Acceptance criteria:
- Dashboard, activities, calendar, and analytics are visually cohesive.
- Activity detail pages present data clearly.
- Charts and summary cards are readable and consistent.
- Mobile/tablet layouts remain usable.
- Existing tests pass.
```

---

# Milestone 11: Web Garmin bulk import

## Goal
Turn the existing CLI Garmin bulk import into a web-managed workflow.

The CLI import already works. This milestone should reuse existing import services instead of creating a separate import pipeline.

## UX principle
Browser upload of massive Garmin archives can be fragile. The web UI should support both:

1. Upload from browser for reasonable ZIPs/activity files.
2. Server-side import from a directory path for self-hosted users.

The server-side path import is especially important for Linux self-hosters who can place the Garmin export on the server and import it without browser upload limits.

## Routes

Add or improve authenticated routes:

- `/imports`
- `/imports/new`
- `/imports/[id]`

## Import options

`/imports/new` should support:

### Option A: Upload files through browser

Support:

- `.zip`
- `.fit`
- `.tcx` if parser exists
- `.gpx` if parser exists

Requirements:

- Respect configured max upload size.
- Show clear warning for very large Garmin exports.
- Store uploaded archive under `/data/imports/<batch_id>/uploads/`.
- Reuse the existing recursive ZIP extraction and import service.

### Option B: Import from server path

For self-hosted users only.

Form fields:

- source path
- optional import label

Requirements:

- Restrict to configured import roots, e.g. `/data/incoming`.
- Do not allow arbitrary filesystem access by default.
- Validate and normalize paths.
- Reject paths outside allowed roots.
- Reuse the existing CLI import service.

Suggested env vars:

- `OPENIBEX_IMPORT_ROOT=/data/incoming`
- `OPENIBEX_MAX_UPLOAD_MB=1024`

## Database

Reuse existing `import_batches` and `import_items` tables if present.

If not present, add them according to the earlier bulk import milestone.

Add fields only if needed:

- `triggered_by`: `cli`, `web_upload`, `web_server_path`
- `display_name` or `label`

## Processing model

Keep it simple:

- Create import batch from web action.
- Process sequentially in the request only for small uploads, or preferably enqueue as pending import items.
- Add a simple import processor script/command if not already present.
- Do not add Redis/Celery/queue infrastructure.

If long-running imports are needed, add:

```bash
pnpm import:process
```

which processes pending import batches/items from SQLite.

## UI behavior

`/imports` should show:

- batch name/source
- status
- created date
- total files
- processed files
- imported
- duplicates
- failed

`/imports/[id]` should show:

- progress summary
- imported count
- duplicate count
- failed count
- per-item failure details
- link to imported activities
- safe rerun guidance

## Safety requirements

- Do not request Garmin credentials.
- Do not call Garmin APIs.
- Never delete the user's original Garmin export.
- Prevent zip-slip attacks.
- Prevent arbitrary server filesystem reads.
- Only authenticated users can access their own imports.
- Admin-only server-path import is acceptable if needed.

## Acceptance criteria

- User can start a Garmin import from the web UI.
- User can upload a supported archive/file from the browser.
- User can import from a configured server-side directory.
- Existing CLI import still works.
- Both web and CLI import call the same service layer.
- Import progress/history is visible in the UI.
- Failed files do not abort the whole batch.
- Rerunning imports remains idempotent.
- Existing tests pass.

## Codex prompt

```text
You are building OpenIbex from the main PRD and Milestones 8+ Addendum.

Milestone 7 is complete and the Garmin bulk import works from the CLI. Start Milestone 11 only: web Garmin bulk import.

Goal:
Expose the existing Garmin bulk import pipeline through authenticated web pages while preserving the CLI importer.

Requirements:
- Add /imports, /imports/new, and /imports/[id] if not already present.
- Support browser upload for .zip and supported activity files.
- Support self-hosted server-path import from a configured safe import root such as /data/incoming.
- Reuse the existing import service used by the CLI. Do not create a second import implementation.
- Keep SQLite and Drizzle.
- Do not add Redis, Postgres, PocketBase, Garmin API calls, scraping, OAuth, or Go API.
- Do not request Garmin credentials.
- Prevent zip-slip and arbitrary filesystem access.
- Preserve idempotent deduplication.
- Show import batch status, counts, failures, duplicates, and links to imported activities.
- Keep tests passing.

Add tests for:
- authenticated user can create upload import batch
- authenticated user can create server-path import batch within allowed root
- path outside allowed root is rejected
- users cannot see another user's import batch
- CLI import still works or service-level import remains covered
- duplicate imports remain idempotent

Update README with:
- Garmin export web import flow
- recommended /data/incoming workflow for large exports
- max upload size env var
- safe import root env var
- reminder that OpenIbex never asks for Garmin credentials

Acceptance criteria:
- Web import works for uploaded activity archive/files.
- Server-path import works for self-hosted users.
- CLI import still works.
- Import history UI shows useful status and failures.
- Existing tests pass.
```

---

# Milestone 12: UI quality pass and regression hardening

## Goal
After the major UI and web import changes, do a quality pass focused on polish, accessibility, consistency, and regression safety.

## Requirements

- Use ui-ux-pro-max if available for review.
- Audit keyboard navigation.
- Audit focus states.
- Audit contrast.
- Audit touch targets.
- Audit responsive layouts.
- Audit empty/loading/error states.
- Add screenshots or visual documentation if practical.
- Fix obvious UI inconsistencies.
- Add tests for critical flows if missing.

## Acceptance criteria

- App feels cohesive.
- Major flows are covered by tests.
- UI is usable on desktop and tablet-sized screens.
- Import failures are understandable.
- Activity/calendar/analytics views are not visually broken.

## Codex prompt

```text
You are building OpenIbex from the main PRD and Milestones 8+ Addendum.

Milestones 8-11 are complete. Start Milestone 12 only: UI quality pass and regression hardening.

Use ui-ux-pro-max if available to review accessibility, layout, hierarchy, responsiveness, forms, charts, and component consistency.

Audit and fix:
- keyboard navigation
- focus states
- color contrast
- touch targets
- responsive behavior
- empty/loading/error states
- inconsistent spacing/typography
- activity/calendar/import workflows

Do not add major new features. Keep this as a polish and regression milestone.

Acceptance criteria:
- Existing tests pass.
- Critical flows have test coverage.
- UI is cohesive and accessible enough for normal use.
- Import workflows remain functional.
```
