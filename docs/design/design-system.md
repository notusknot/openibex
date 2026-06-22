# OpenIbex Design System

## Foundations

OpenIbex uses a plain CSS token system and small Svelte primitives. This matches the PRD preference for plain Svelte components or a simple CSS system and avoids introducing a heavy component framework.

Token source: `src/lib/styles/tokens.css`.

Initial primitives:

- `src/lib/components/ui/AppShell.svelte`
- `src/lib/components/ui/PrimaryNav.svelte`
- `src/lib/components/ui/TopBar.svelte`
- `src/lib/components/ui/PageHeader.svelte`
- `src/lib/components/ui/Panel.svelte`
- `src/lib/components/ui/EmptyState.svelte`
- `src/lib/components/ui/StatusBadge.svelte`
- `src/lib/components/ui/Button.svelte`
- `src/lib/components/ui/Input.svelte`
- `src/lib/components/ui/Select.svelte`
- `src/lib/components/ui/Textarea.svelte`
- `src/lib/components/ui/Alert.svelte`
- `src/lib/components/ui/StatCard.svelte`
- `src/lib/components/ui/LoadingState.svelte`
- `src/lib/components/ui/SectionHeader.svelte`

Milestone 9 wired these primitives through the authenticated shell, public auth pages, and core page layouts. Detailed dashboard, calendar, activity, and analytics redesign remains reserved for Milestone 10.

## Color Palette

Core colors:

| Token | Light value | Dark value | Use |
|---|---:|---:|---|
| `--oi-color-bg` | `#f6f8fb` | `#070b12` | App background |
| `--oi-color-surface` | `#ffffff` | `#0d1420` | Page surfaces and panels |
| `--oi-color-surface-muted` | `#eef3f8` | `#111c2b` | Subtle panels and table headers |
| `--oi-color-text` | `#101827` | `#e7edf6` | Primary text |
| `--oi-color-text-muted` | `#526174` | `#9aa8ba` | Secondary text |
| `--oi-color-border` | `#d8e0ea` | `#263548` | Borders |
| `--oi-color-brand` | `#1f6feb` | `#4f8cff` | Primary actions and data |
| `--oi-color-brand-strong` | `#184fb8` | `#82b1ff` | Primary hover/focus |
| `--oi-color-accent` | `#d97706` | `#f6b44b` | Attention and planned markers |
| `--oi-color-success` | `#0f8a62` | `#47d18c` | Success/close compliance |
| `--oi-color-warning` | `#b7791f` | `#f7c948` | Warning/pending |
| `--oi-color-danger` | `#b42318` | `#ff6b64` | Failed/destructive |

Rules:

- Do not rely on color alone. Status chips must include text.
- Use blue for neutral training data, not for every clickable surface.
- Use amber sparingly for planned work, pending imports, and attention.
- Use danger only for failed imports/errors/destructive actions.

## Sport Colors

| Sport | Token | Value | Intent |
|---|---|---:|---|
| Bike | `--oi-sport-bike` | `#2f80ed` | Speed, endurance data |
| Run | `--oi-sport-run` | `#f97316` | Warm ground contact |
| Swim | `--oi-sport-swim` | `#06b6d4` | Water/aqua |
| Strength | `--oi-sport-strength` | `#8b5cf6` | Controlled load |
| Other | `--oi-sport-other` | `#64748b` | Neutral fallback |

Sport colors should appear as left rules, small dots, badges, or calendar accents. Do not fill large cards with sport color.

## Status And Compliance

Status mapping:

| Status | Token | Use |
|---|---|---|
| Succeeded/imported/complete | `--oi-color-success` | Completed system outcomes |
| Pending/processing | `--oi-color-warning` | Work in progress |
| Failed/error | `--oi-color-danger` | User attention and recovery |
| Duplicate/info | `--oi-color-info` | Non-destructive diagnostic |

Compliance mapping:

| Compliance | Ratio | Label |
|---|---:|---|
| Under | `< 0.80` | Under |
| Close | `0.80 - 1.20` | Close |
| Over | `> 1.20` | Over |

Display raw percentages when available, but cap visual bars at a readable maximum so one outlier does not dominate.

## Typography

Use system fonts by default to preserve self-hosted privacy and avoid external font requests:

- UI: `Inter`, `ui-sans-serif`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif.
- Metrics/code: `ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, monospace.

Scale:

| Token | Value | Use |
|---|---:|---|
| `--oi-font-size-xs` | `0.75rem` | Table captions, pills |
| `--oi-font-size-sm` | `0.875rem` | Metadata, dense controls |
| `--oi-font-size-md` | `1rem` | Body text |
| `--oi-font-size-lg` | `1.125rem` | Card headings |
| `--oi-font-size-xl` | `1.375rem` | Page subheads |
| `--oi-font-size-2xl` | `1.75rem` | Page titles |

Rules:

- Use tabular numerals for metrics, tables, dates, times, durations, distances, and load values.
- Do not use viewport-scaled font sizes.
- Keep letter spacing at `0`, except small uppercase labels may use `0.04em`.

## Spacing

Use a compact 4px-based scale:

| Token | Value |
|---|---:|
| `--oi-space-1` | `0.25rem` |
| `--oi-space-2` | `0.5rem` |
| `--oi-space-3` | `0.75rem` |
| `--oi-space-4` | `1rem` |
| `--oi-space-5` | `1.25rem` |
| `--oi-space-6` | `1.5rem` |
| `--oi-space-8` | `2rem` |

Density rules:

- Metric cards: 12px to 16px padding.
- Data tables: 8px vertical padding, 10px to 12px horizontal padding.
- Forms: 12px row gaps.
- Calendar cells: compact but minimum stable height.

## Radius And Elevation

Radius:

- `--oi-radius-sm`: `4px`
- `--oi-radius-md`: `6px`
- `--oi-radius-lg`: `8px`
- `--oi-radius-pill`: `999px`

Use 8px or less for cards and panels. Reserve pill radius for badges and compact status chips.

Elevation:

- Default panels rely on borders, not heavy shadows.
- Use `--oi-shadow-sm` only for active overlays, menus, and focused work surfaces.
- Avoid nested cards. Use sections inside panels rather than cards inside cards.

## Layout

Implemented authenticated layout:

- Left navigation rail on desktop.
- Compact sticky top header plus horizontal primary navigation on mobile/tablet.
- Active route highlighting via `aria-current="page"`.
- Visible skip link and keyboard focus states.
- Calendar and work surfaces should use more horizontal space than the current 960px shell when screen width allows.
- Content max width should vary by page type:
  - Calendar, analytics, import tables: wide.
  - Forms and settings detail: narrow.
  - Activity detail: medium/wide with metric grids.
- Mobile navigation remains visible and horizontally scrollable rather than hidden behind a menu.

## Dark Mode Behavior

Dark mode is token-based and minimal:

- The app follows `prefers-color-scheme: dark` by default.
- `[data-theme='dark']` and `[data-theme='light']` hooks exist for a future explicit setting.
- No database-backed theme preference exists in Milestone 9.
- Components use tokens so later theme work should not require page rewrites.

## Components

### Page Header

Use for route title, short description, filters, and primary action.

Required behavior:

- One clear primary action.
- Secondary controls align right on desktop and wrap below on mobile.
- Supports compact density for table-heavy pages.

### Panel

Use for dashboard cards, analytics chart containers, import summaries, and forms.

Rules:

- One panel equals one conceptual group.
- Do not put panels inside panels.
- Use a header action slot for small contextual links or buttons.

### Empty State

Use for dashboard, calendar, activities, analytics, imports, and export states.

Rules:

- Explain what is missing.
- Offer the next action.
- Avoid decorative illustration requirements.

### Status Badge

Use for import states, compliance, match types, and parser/file outcomes.

Rules:

- Include readable text.
- Use color only as reinforcement.
- Keep badge text short and lowercase or title case consistently within each page.

## Tables

Tables are first-class UI for OpenIbex.

Rules:

- Wrap wide tables in a named scroll region.
- Sticky table headers are acceptable for import and analytics tables.
- Numeric columns should align right when rows become dense.
- Preserve visible row separators.
- Use monospace only for hashes, paths, IDs, and fixed-width diagnostics.

## Forms

Rules:

- Labels above inputs.
- Form errors use `role="alert"` or `aria-live="polite"`.
- Primary submit button uses brand color.
- Destructive actions use danger styling and should remain visually separate from save actions.
- Optional fields should be marked in the label text.
- Units should appear in labels or suffix text until unit preference is implemented broadly.

## Loading, Error, And Success States

Loading:

- Prefer skeleton blocks or compact inline loading text.
- Avoid spinners as the only indicator for long imports.

Error:

- Show what failed.
- Show recovery action when possible.
- Do not expose raw filesystem paths except in authenticated import diagnostics where already part of the user's self-hosted workflow.

Success:

- Use concise confirmation near the completed action.
- Avoid modal confirmation for routine saves.

## Responsive Behavior

Breakpoints:

- Small: 375px
- Tablet: 768px
- Laptop: 1024px
- Wide: 1440px

Rules:

- Calendar can remain horizontally dense, but text must not overlap.
- Tables scroll horizontally below their natural width.
- Header actions wrap rather than shrink text into unreadable buttons.
- Cards and metric grids should use `repeat(auto-fit, minmax(...))`.

## Chart Rules

Color roles:

- Fitness: neutral text/data color or brand strong.
- Fatigue: brand blue.
- Freshness: success green when positive, danger when negative if represented separately.
- Planned: accent amber.
- Completed: brand blue or sport color.

Rules:

- Include visible legends.
- Use labels, line styles, or markers in addition to color.
- Keep chart containers compact and aligned with tables.
- Preserve table fallback data.
