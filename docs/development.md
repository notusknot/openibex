# Development workflow & enforcement

How we work, and — more importantly — **where the guarantees actually are**. The short version:
local hooks give fast feedback but are bypassable; **CI + GitHub branch protection are the only
unbypassable gate.**

## The rules

1. **Branch per feature. Never commit directly to `main`.**
2. **Every code change ships its CHANGELOG entry** under `[Unreleased]` in the *same* commit.
3. **Run `pnpm check` + `pnpm test` before proposing a merge** (the pre-commit hook does this for
   you).
4. **Versioning happens only at release time** — cut `[Unreleased]` into a dated `[x.y.z]` block
   and bump `package.json`; tag `vX.Y.Z`. Not on every feature merge. Pre-1.0 SemVer
   (`0.MINOR.PATCH`).

## Where enforcement lives

| Layer | Enforces | Kind | Bypass |
|---|---|---|---|
| **GitHub branch protection** on `main` | No direct push; PR + green CI required to merge | **Mechanical — the real gate** | Only by editing the rule (admins) |
| **CI · verify** | `pnpm check` + `pnpm test` + `pnpm build` pass | **Mechanical** (gates merge via protection) | — |
| **CI · changelog** | Source changed ⇒ `docs/CHANGELOG.md` updated (PRs) | **Mechanical** | — |
| **CI · docker-smoke** | Container boots; `/api/health` returns `{"ok":true}` | **Mechanical** | — |
| `.githooks/pre-commit` | `check` + `test` before a local commit | Local convenience | `git commit --no-verify` |
| `.claude/` commit-guard | Agent can't commit on `main` or with failing tests | Agent-only | A human committing directly; disabling the hook |
| CLAUDE.md "Development Workflow" | The rules above | Prose / guidance | n/a |

**Read this carefully:** the two local hooks (`.githooks/pre-commit` and the Claude commit-guard)
are *not* guarantees. A `--no-verify` flag skips the git hook, and the Claude hook only constrains
the agent — neither stops a determined human or another tool. The enforcement that cannot be
bypassed is **branch protection requiring the CI checks to pass**. Configure it.

## Feature lifecycle

Every change follows the same loop — small commits on a short-lived branch, merged through a
green PR:

1. **Branch from fresh `main`:** `git checkout main && git pull --ff-only`, then
   `git checkout -b feat/short-name` (prefixes: `feat/ fix/ chore/ docs/ refactor/`).
2. **Commit small.** Each code change updates `docs/CHANGELOG.md` `[Unreleased]` in the *same* commit;
   if it ships a `ROADMAP.md` item, delete that line in the same commit too. The pre-commit hook
   runs `pnpm check` + `pnpm test` automatically.
3. **Final gate before the PR:** `pnpm check && pnpm test && pnpm build`.
4. **Push and open a PR** against `main`: `git push -u origin feat/short-name`. CI runs the three
   jobs (verify · changelog · docker-smoke).
5. **Iterate** until review approves *and* CI is green.
6. **Merge, then clean up.** Squash for a tidy single commit on `main`, or rebase/merge to keep the
   atomic commits; delete the branch; then `git checkout main && git pull --ff-only` and
   `git branch -d feat/short-name`.

Releases are separate and periodic — see [Cutting a release](#cutting-a-release).

## Enabling branch protection (one-time, in GitHub settings)

You must do this in the GitHub UI — it isn't a repo file. First push this branch and open a PR so
the CI checks register, then:

**Settings → Branches → Add branch protection rule** (or **Rulesets**), branch name pattern `main`:

- ☑️ **Require a pull request before merging** (this is what blocks direct pushes to `main`).
  - Optionally: **Require approvals** → 1.
- ☑️ **Require status checks to pass before merging**
  - ☑️ **Require branches to be up to date before merging**
  - Add these required checks (they appear after the workflow has run once — they are the CI
    **job names**):
    - `typecheck · test · build`
    - `changelog updated`
    - `docker health smoke test`
- ☑️ **block force pushes**
- ☑️ **restrict deletions**
- optional: **require linear history**; **do not allow bypassing the above settings** (applies the
  rule to admins too).

Once this is on, a feature branch can only reach `main` through a PR whose CI is green — which is
the point of everything else in this document.

## Cutting a release

1. On a release branch, move everything under `[Unreleased]` in `docs/CHANGELOG.md` into a new
   `## [x.y.z] - YYYY-MM-DD` block; leave `[Unreleased]` empty.
2. Bump `version` in `package.json`.
3. Update the compare links at the bottom of `docs/CHANGELOG.md`.
4. Merge via PR, then tag: `git tag vX.Y.Z && git push --tags`.
