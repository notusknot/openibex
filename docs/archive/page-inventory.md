> ⚠️ **ARCHIVED — NOT AUTHORITATIVE.** Historical snapshot, kept for context. It may describe plans that shipped, changed, or were dropped. For current state see `CHANGELOG.md` (shipped) and `ROADMAP.md` (planned); for how the system works now see `docs/ARCHITECTURE.md` and `docs/DOMAIN.md`. Do not treat anything below as current.

# OpenIbex Page Inventory

This inventory reflects the authenticated routes present during Milestone 8. It is intended to guide Milestones 9 and 10 without changing routes or business logic.

## Authenticated Shell

Route file: `src/routes/(app)/+layout.svelte`

- Purpose: Provide authenticated navigation, user identity, logout, skip link, and main content container.
- Primary user action: Navigate between training surfaces.
- Secondary actions: Logout; identify current user.
- Data density: Medium.
- Current UX problems: Top nav wraps quickly, no active route state, shell max width is too narrow for calendar/import/analytics tables, button/link styling is local to shell, user menu is plain text plus logout.
- Redesign notes: Create a cockpit-like app frame with persistent primary navigation, active states, wider work area, compact user menu, and responsive mobile navigation.
- Reusable components needed: App shell, nav item, page header, button, status badge.

## Dashboard

Route file: `src/routes/(app)/dashboard/+page.svelte`

- Purpose: Entry point after login.
- Primary user action: Decide whether to review calendar, upload activities, or inspect recent training.
- Secondary actions: Jump to calendar or activities.
- Data density: Currently low; target medium/high.
- Current UX problems: Placeholder only, no weekly metrics, no recent activities, no upcoming workouts, no upload call-to-action beyond inline links.
- Redesign notes: In later milestones, show this week duration/distance/load, upcoming planned workouts, recent completed activities, import status, and calendar preview. Keep it compact and actionable.
- Reusable components needed: PageHeader, MetricCard, Panel, ActivityCard, EmptyState, StatusBadge.

## Calendar

Route files:

- `src/routes/(app)/calendar/+page.svelte`
- `src/routes/(app)/calendar/+page.server.ts`

- Purpose: Month view for planned workouts, completed activities, and planned/completed matching.
- Primary user action: Review training schedule and create planned workouts.
- Secondary actions: Filter by sport, navigate months, open planned workout edit, open activity detail, create workout on a specific date.
- Data density: High.
- Current UX problems: Month grid is functional but visually generic, sport colors are text-only, add controls are small plus signs without tooltip text, compliance pill can crowd day cells, mobile layout compresses cells rather than offering a clearer alternate view.
- Redesign notes: Calendar remains the first-class work surface. Use sport accents, planned/completed distinction, compact day headers, status chips for matched workouts, and stable cell dimensions. Preserve month and sport query params.
- Reusable components needed: PageHeader, Toolbar, SportBadge, StatusBadge, CalendarCell, EmptyState, ButtonLink.

## New Planned Workout

Route files:

- `src/routes/(app)/calendar/new/+page.svelte`
- `src/routes/(app)/calendar/new/+page.server.ts`

- Purpose: Create planned workout from calendar context.
- Primary user action: Submit a planned workout.
- Secondary actions: Choose sport/date, add duration/distance/load, cancel.
- Data density: Medium.
- Current UX problems: Labels use raw SI units and seconds, form width/styling is page-local, errors are visual-only text, no contextual header showing selected date.
- Redesign notes: Use shared form panel, action bar, alert component, and field help for units. Keep business validation unchanged.
- Reusable components needed: PageHeader, Panel, FormField pattern, Button, Alert.

## Edit Planned Workout

Route files:

- `src/routes/(app)/calendar/[id]/edit/+page.svelte`
- `src/routes/(app)/calendar/[id]/edit/+page.server.ts`

- Purpose: Edit or delete a planned workout and manage manual activity matching.
- Primary user action: Save planned workout changes.
- Secondary actions: Link/unlink completed activity, delete planned workout, return to calendar.
- Data density: Medium/high.
- Current UX problems: Several independent cards repeat local styling, success/error messages are plain text, destructive delete sits close to routine actions, compliance copy is not visually structured.
- Redesign notes: Split into clear panels for plan details, match status, candidate linking, and danger zone. Use status badges for match type and compliance.
- Reusable components needed: PageHeader, Panel, StatusBadge, Alert, Button, DangerZone pattern.

## Activities List

Route files:

- `src/routes/(app)/activities/+page.svelte`
- `src/routes/(app)/activities/+page.server.ts`

- Purpose: Recent activity and import job overview.
- Primary user action: Open an activity or upload a FIT file.
- Secondary actions: Inspect recent import status/errors.
- Data density: Medium.
- Current UX problems: Recent imports and activities are simple stacked lists, no sport color mapping, no compact metric columns, import status styling is incomplete, empty state is text-only.
- Redesign notes: Use a compact activity list/table hybrid with sport accents, date, duration, distance, and import status chips. Keep recent imports visible but not dominant.
- Reusable components needed: PageHeader, ActivityCard, DataList, StatusBadge, EmptyState, ButtonLink.

## Activity Upload

Route files:

- `src/routes/(app)/activities/upload/+page.svelte`
- `src/routes/(app)/activities/upload/+page.server.ts`

- Purpose: Upload and import a FIT activity.
- Primary user action: Select FIT file and submit.
- Secondary actions: Return to activities.
- Data density: Low/medium.
- Current UX problems: File input is plain, errors are visual-only, page does not show max file size or duplicate/import expectations.
- Redesign notes: Use upload panel with accepted format, privacy note, original-file preservation note, and role-alert errors. Do not add GPX/TCX until product scope changes.
- Reusable components needed: PageHeader, Panel, Alert, Button.

## Activity Detail

Route files:

- `src/routes/(app)/activities/[id]/+page.svelte`
- `src/routes/(app)/activities/[id]/+page.server.ts`

- Purpose: Inspect parsed activity summary, original file metadata, and planned workout match.
- Primary user action: Review metrics and linked plan.
- Secondary actions: Download original file, unlink planned match, return to activities.
- Data density: High.
- Current UX problems: Metrics render as label rows instead of scannable metric cards, no sport/date hierarchy, hashes can dominate the page, compliance is plain copy, no chart/stream placeholder.
- Redesign notes: Top summary should lead with sport, date/time, duration, distance, elevation, load if available, then secondary panels for physiology metrics, file provenance, and match status. Keep original file download prominent for data ownership.
- Reusable components needed: PageHeader, MetricGrid, Panel, StatusBadge, DataRow, Button.

## Imports List

Route files:

- `src/routes/(app)/imports/+page.svelte`
- `src/routes/(app)/imports/+page.server.ts`

- Purpose: Show Garmin/bulk import batch history generated by CLI today and web UI later.
- Primary user action: Open an import batch.
- Secondary actions: Understand status, progress, imported/duplicate/failed counts.
- Data density: High.
- Current UX problems: Table is useful but visually plain, status is raw text, empty state only mentions CLI, progress has no visual affordance, no action for future web import yet.
- Redesign notes: Preserve dense table. Add status badges, progress bars, failure emphasis, and a self-hosted CLI/server-path workflow note. Future Milestone 11 can add `/imports/new`.
- Reusable components needed: PageHeader, DataTable, StatusBadge, ProgressBar, EmptyState.

## Import Detail

Route files:

- `src/routes/(app)/imports/[id]/+page.svelte`
- `src/routes/(app)/imports/[id]/+page.server.ts`

- Purpose: Inspect one import batch, failures, and latest items.
- Primary user action: Diagnose failed or duplicate files.
- Secondary actions: Open imported activity, return to imports.
- Data density: Very high.
- Current UX problems: Summary meta grid is unstructured, failures and items tables share raw styling, hashes/paths can overwhelm, no status color or recovery guidance.
- Redesign notes: Use compact summary metrics, priority failure panel above full item table, status badges, mono columns, and clear "latest 500" framing.
- Reusable components needed: PageHeader, MetricGrid, DataTable, StatusBadge, Panel, EmptyState.

## Analytics

Route files:

- `src/routes/(app)/analytics/+page.svelte`
- `src/routes/(app)/analytics/+page.server.ts`

- Purpose: Review weekly duration, distance, elevation, load, fitness, fatigue, freshness, and compliance.
- Primary user action: Filter by date range/week count and sport.
- Secondary actions: Scan chart, inspect weekly table and totals.
- Data density: High.
- Current UX problems: Chart has no axes or grid, legend is text-heavy, filters are plain, totals are sentence strings, table is dense but not visually optimized.
- Redesign notes: Keep the table fallback. Use compact filters, line chart panel, metric totals, clearer planned/completed comparison, and chart colors from the design system.
- Reusable components needed: PageHeader, FilterBar, ChartPanel, MetricCard, DataTable, EmptyState.

## Settings

Route file: `src/routes/(app)/settings/+page.svelte`

- Purpose: Account and data management hub.
- Primary user action: Choose profile or data export.
- Secondary actions: Understand account/data ownership scope.
- Data density: Low.
- Current UX problems: Cards are generic, no instance/self-hosting context, no status/role summary.
- Redesign notes: Keep simple but align with app shell. Later add instance info, backup hints, and storage/import diagnostics when product scope reaches those features.
- Reusable components needed: PageHeader, PanelLink, EmptyState style for future missing settings.

## Settings Profile

Route files:

- `src/routes/(app)/settings/profile/+page.svelte`
- `src/routes/(app)/settings/profile/+page.server.ts`

- Purpose: View email/role and edit display name.
- Primary user action: Save display name.
- Secondary actions: Review account role.
- Data density: Low/medium.
- Current UX problems: Repeated page-local card/form styles, success/error messages are visual-only, role is not styled as a badge.
- Redesign notes: Use account summary panel, role badge, shared form controls, and accessible alerts.
- Reusable components needed: PageHeader, Panel, StatusBadge, Alert, Button.

## Settings Export

Route files:

- `src/routes/(app)/settings/export/+page.svelte`
- `src/routes/(app)/settings/export/+page.server.ts`

- Purpose: Generate and download user data export.
- Primary user action: Generate export archive.
- Secondary actions: Return to settings, understand export contents.
- Data density: Low/medium.
- Current UX problems: Export contents are one sentence, errors are visual-only, no ownership/privacy framing.
- Redesign notes: Use data ownership panel listing metadata, planned workouts, comments/notes, settings, and original uploaded files. Keep single primary action.
- Reusable components needed: PageHeader, Panel, Alert, Button.
