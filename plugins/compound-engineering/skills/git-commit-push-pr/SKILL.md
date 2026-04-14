---
name: git-commit-push-pr
description: "Commit, push, and open a PR with an adaptive description. Also update an existing PR description. Use when the user wants to go from working changes to an open PR in one step."
---

# Commit, Push, and PR

Go from working changes to an open pull request, or update an existing PR description.

## Input

<pr_input> #$ARGUMENTS </pr_input>

## Workflow

### Description Update Mode

If the user asks to update an existing PR description (e.g., "update the PR", "rewrite the description"):

1. **Identify the PR** -- Use `gh pr view` or the provided PR number
2. **Gather context** -- Read commits, diff, and current description
3. **Rewrite description** -- Apply the PR writing guidelines below
4. **Update** -- Use `gh pr edit` to apply the new description

### Full Workflow

#### Step 1: Gather Context

```bash
git status
git diff HEAD
git branch --show-current
git log --oneline -10
```

#### Step 2: Determine Conventions

Check for PR templates in `.github/PULL_REQUEST_TEMPLATE.md` or similar.
Follow repo commit message conventions.

#### Step 3: Check for Existing PR

```bash
gh pr view --json number,title,url 2>/dev/null
```

If a PR already exists, ask whether to update it or create a new one.

#### Step 4: Stage and Commit

Stage and commit changes following the `git-commit` skill workflow.

#### Step 5: Push

```bash
git push -u origin $(git branch --show-current)
```

#### Step 6: Write PR Description

**Sizing guide:**
| Change size | Description style |
|-------------|-------------------|
| Trivial (typo, config) | One-liner title, no body needed |
| Small (1-3 files) | Brief summary, key changes |
| Medium (4-10 files) | Summary, notable changes, test plan |
| Large (10+ files) | Summary, architecture notes, test plan, migration notes |

**PR description structure:**
```markdown
## Summary
[1-3 bullet points describing what and why]

## Changes
[Notable implementation details, if non-obvious]

## Test Plan
[How to verify the changes work]
```

#### Step 7: Create PR

```bash
gh pr create --title "title" --body "description"
```

#### Step 8: Report

Output the PR URL and a brief summary of what was created.
