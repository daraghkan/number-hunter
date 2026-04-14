---
name: git-commit
description: "Create a git commit with a clear, value-communicating message. Use when the user says 'commit', 'commit this', 'save my changes', 'create a commit', or wants to commit staged or unstaged work."
---

# Git Commit

Create a single, well-crafted git commit from the current working tree changes.

## Context

**Git status:**
!`git status`

**Working tree diff:**
!`git diff HEAD`

**Current branch:**
!`git branch --show-current`

**Recent commits:**
!`git log --oneline -10`

**Remote default branch:**
!`git rev-parse --abbrev-ref origin/HEAD 2>/dev/null || echo '__DEFAULT_BRANCH_UNRESOLVED__'`

## Workflow

### Step 1: Gather context

Use the context above (git status, working tree diff, current branch, recent commits, remote default branch). All data needed for this step is already available -- do not re-run those commands.

The remote default branch value returns something like `origin/main`. Strip the `origin/` prefix to get the branch name. If it returned `__DEFAULT_BRANCH_UNRESOLVED__`, try:

```bash
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
```

If both fail, fall back to `main`.

If the git status shows a clean working tree, report that there is nothing to commit and stop.

If the current branch is empty, the repository is in detached HEAD state. Explain that a branch is required and ask whether to create a feature branch now.

### Step 2: Determine commit message convention

Follow this priority order:

1. **Repo conventions already in context** -- If project instructions specify commit message conventions, follow those.
2. **Recent commit history** -- Examine the 10 most recent commits. If a clear pattern emerges (conventional commits, ticket prefixes, emoji prefixes), match that pattern.
3. **Default: conventional commits** -- `type(scope): description` where type is one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `style`, `build`.

### Step 3: Consider logical commits

Before staging everything together, scan the changed files for naturally distinct concerns. If modified files clearly group into separate logical changes, create separate commits for each group.

Keep this lightweight:
- Group at the **file level only** -- do not use `git add -p`
- If the separation is obvious, split. If ambiguous, one commit is fine.
- Two or three logical commits is the sweet spot.

### Step 4: Stage and commit

If the current branch is the default branch, warn the user and ask whether to continue or create a feature branch first.

Write the commit message:
- **Subject line**: Concise, imperative mood, focused on *why* not *what*
- **Body** (when needed): Add for non-trivial changes explaining motivation and trade-offs

```bash
git add file1 file2 file3 && git commit -m "$(cat <<'EOF'
type(scope): subject line here

Optional body explaining why this change was made.
EOF
)"
```

### Step 5: Confirm

Run `git status` after the commit to verify success. Report the commit hash(es) and subject line(s).
