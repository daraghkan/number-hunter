---
name: changelog
description: "Create engaging changelogs for recent merges. Use when preparing release notes, summarizing recent changes, or creating a changelog entry for merged PRs."
---

# Changelog

Create an engaging changelog entry from recent merged PRs and commits.

## Input

<changelog_input> #$ARGUMENTS </changelog_input>

## Workflow

### Step 1: Gather Recent Changes

```bash
git log --oneline --merges -20
git log --oneline -30 --no-merges
```

If a date range or version tag is provided, scope the log accordingly.

### Step 2: Categorize Changes

Group changes into:
- **Features** -- New capabilities
- **Improvements** -- Enhancements to existing features
- **Bug Fixes** -- Resolved issues
- **Breaking Changes** -- Changes requiring user action
- **Internal** -- Refactors, dependency updates, CI changes

### Step 3: Write the Changelog

For each change:
- Write a user-facing description (not implementation-focused)
- Link to the PR or commit when available
- Highlight breaking changes prominently

### Step 4: Output

Write the changelog entry to the appropriate file or present it for review.
