#!/usr/bin/env sh
#
# Claude Code commit guard — PreToolUse hook on the Bash tool.
#
# Blocks the AGENT from creating a git commit when either:
#   1. the current branch is `main`, or
#   2. the test suite (`pnpm test`) fails.
#
# Exit codes: 0 = allow the Bash call, 2 = block it (stderr is fed back to Claude).
# This constrains the agent only and is overridable by a human; it is NOT a
# substitute for CI + branch protection. See docs/development.md.
#
# Fails open: if the command can't be parsed, the call is allowed.

payload=$(cat)

# Cheap pre-filter: do nothing for the vast majority of Bash calls that have
# nothing to do with committing.
case "$payload" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

# Pull the real command string out of the hook JSON so we don't act on stray
# mentions of "git commit" inside unrelated payloads.
cmd=$(printf '%s' "$payload" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.command)||"")}catch(e){process.stdout.write("")}})' 2>/dev/null)

# Only guard actual `git commit` invocations (e.g. `git commit`, `git -C dir commit`),
# not things like `git log --grep commit` or `echo "git commit"`.
if ! printf '%s' "$cmd" | grep -qE '\bgit( +-[^ ]+)* +commit\b'; then
  exit 0
fi

# 1) Never commit on main.
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$branch" = "main" ]; then
  echo "commit-guard: refusing to commit on 'main'. Create a feature branch first (CLAUDE.md -> Development Workflow)." >&2
  exit 2
fi

# 2) Tests must pass.
log=$(mktemp 2>/dev/null || echo /tmp/openibex-commit-guard.log)
if ! pnpm test >"$log" 2>&1; then
  echo "commit-guard: tests are failing -- fix them before committing. Last lines of output:" >&2
  tail -n 20 "$log" >&2
  exit 2
fi

exit 0
