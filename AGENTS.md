# AGENTS.md

This repo keeps one source of truth for agent guidance, shared across tools (Claude Code, Cursor,
Codex, Gemini, etc.). **This file is only a pointer** — don't duplicate content here; update the
authoritative docs instead.

Start here:

- **[CLAUDE.md](CLAUDE.md)** — orientation: stack, directory map, conventions, commands, critical
  gotchas, and the Development Workflow rules. Read this first.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — data flow and the reasoning behind non-obvious
  decisions.
- **[docs/DOMAIN.md](docs/DOMAIN.md)** — training-load / PMC formulas, dedup guarantees, data-model
  invariants.
- **[docs/development.md](docs/development.md)** — branch protection and where enforcement actually
  lives (CI vs. local hooks).
- **[CHANGELOG.md](docs/CHANGELOG.md)** — what has shipped. **[ROADMAP.md](docs/ROADMAP.md)** — what is
  planned (and the rule that shipped work moves from ROADMAP into CHANGELOG).

Historical, non-authoritative material is under `docs/archive/` — do not treat it as current.
