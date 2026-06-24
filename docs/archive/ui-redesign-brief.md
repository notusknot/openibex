> ⚠️ **ARCHIVED — NOT AUTHORITATIVE.** Historical snapshot, kept for context. It may describe plans that shipped, changed, or were dropped. For current state see `CHANGELOG.md` (shipped) and `ROADMAP.md` (planned); for how the system works now see `docs/ARCHITECTURE.md` and `docs/DOMAIN.md`. Do not treat anything below as current.

# OpenIbex UI Redesign Brief

## Scope

This brief covers Milestone 8 from the Milestones 8+ addendum. It defines the product direction and design constraints for later UI implementation milestones. It does not change backend behavior, route structure, data models, telemetry, imports, maps, or external integrations.

Source of truth:

- Main PRD: product goals, SvelteKit + SQLite + Drizzle stack, service/repository architecture, privacy constraints, self-hosting constraints.
- Milestones 8+ addendum: next UI and import milestones.
- `ui-ux-pro-max` skill: used for SvelteKit dashboard guidance, dark-mode/data-dashboard direction, table handling, error announcement, empty states, active navigation, and chart recommendations.

## Product Position

OpenIbex is a self-hosted endurance training cockpit for athletes who care about data ownership, transparent analytics, and fast daily planning. The app should feel powerful enough for serious training review while staying calm, practical, and reliable.

The first impression should be:

- Calendar-first training control.
- Fast access to upload/import status.
- Dense, readable summaries of completed and planned work.
- Self-hosted power-user confidence instead of consumer fitness gamification.
- Transparent analytics with visible formulas and exportable data.

## Visual Direction

Use a modern endurance training cockpit style:

- Dark-mode friendly foundation with strong light-mode contrast.
- Matte surfaces, crisp borders, and compact panels.
- Blue data accents, amber attention accents, and restrained status colors.
- Compact typography with tabular numerals for metrics.
- Athletic but not playful.
- Technical but not cold or enterprise-generic.
- Calendar and tables should feel like primary work surfaces, not afterthoughts.

Avoid:

- TrainingPeaks pixel copying, branding, layout duplication, or visual assets.
- Large marketing hero sections inside the authenticated app.
- Overuse of gradients, glow, glass, blur, or decorative backgrounds.
- Hiding key data behind excessive whitespace.
- One-off page CSS that prevents later consistency.
- External fonts unless the project explicitly accepts outbound font loading or vendors fonts locally.

## Design Principles

1. Calendar first.
   The calendar is the athlete's operating surface. Navigation, dashboard summaries, and analytics should reinforce a weekly/monthly training rhythm.

2. Dense but readable.
   Use compact spacing and small panels for repeated information, but preserve clear section headers, alignment, and scan paths. Tables should support horizontal scroll before they collapse into broken mobile layouts.

3. Data has hierarchy.
   Show primary training signals first: sport, date, duration, distance, load, compliance, status. Put filenames, hashes, parser versions, and diagnostics in secondary/detail areas.

4. Fast and local.
   UI should feel immediate on a self-hosted instance. Prefer simple CSS, plain Svelte components, and server-rendered data already available from page loads.

5. Transparent and recoverable.
   Errors should explain what failed and what to do next. Empty states should tell the user which action unlocks the page.

6. Future API ready.
   Components should consume explicit page data shapes, not database row assumptions. UI changes must preserve the PRD's route/service/repository boundary.

## Interaction Model

Primary workflows:

- Review the training calendar.
- Create or edit planned workouts.
- Upload FIT files.
- Inspect activity detail and original file metadata.
- Review import history and failures.
- Review weekly analytics and fitness/fatigue/freshness trends.
- Export all data.

Navigation should prioritize:

1. Dashboard
2. Calendar
3. Activities
4. Imports
5. Analytics
6. Settings

The main PRD also names Planning in navigation. Current routes implement planning through `/calendar/new` and `/calendar/[id]/edit`; do not add a new route during Milestone 8. Later milestones should decide whether Planning becomes a distinct route or remains calendar-integrated.

## Accessibility And Responsiveness

Minimum expectations for later implementation:

- Semantic `header`, `nav`, `main`, `section`, `table`, `button`, and `form` elements.
- Visible focus states using tokenized focus colors.
- `role="alert"` or `aria-live="polite"` for validation, import, upload, and export feedback.
- Active navigation state.
- Horizontal scroll wrappers for dense tables.
- Minimum 44px touch targets for primary mobile actions where practical.
- No color-only status indicators; pair color with labels, icons, or text.
- Respect `prefers-reduced-motion`.
- Test at 375px, 768px, 1024px, and 1440px.

## Chart Direction

Use simple chart types before adding a charting dependency:

- Line charts for fitness, fatigue, freshness, load, and time-series trends.
- Bar charts for weekly totals and planned vs completed comparisons.
- Bullet or compact progress bars for compliance against planned targets.
- Calendar heat/density treatment only if it remains readable and accessible.

When multiple series are shown, combine distinct colors with labels and line styles. Always provide the table data already present in the app as an accessible fallback.

## Implementation Boundaries

Milestone 8 should add design documentation, tokens, and low-risk primitives only. Later milestones should apply them incrementally.

Do not:

- Change business logic.
- Add a component framework.
- Add Tailwind unless explicitly chosen in a later architecture decision.
- Add external telemetry.
- Add external map tiles.
- Add Garmin web upload yet.
- Add a Go API.
- Rewrite the authenticated app shell in this milestone.

## Milestone Handoff

Milestone 9 should use:

- `docs/design/design-system.md` for tokens, primitives, density rules, and component behavior.
- `docs/design/page-inventory.md` for per-page implementation notes.
- `src/lib/styles/tokens.css` for CSS custom properties.
- `src/lib/components/ui/*` as initial reusable primitives.

Milestone 10 should focus on page-level application of the system to dashboard, calendar, activities, activity detail, and analytics.
