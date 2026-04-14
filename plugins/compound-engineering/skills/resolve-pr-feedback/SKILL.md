---
name: resolve-pr-feedback
description: "Resolve PR review feedback in parallel. Use when you have pending review comments on a PR that need to be addressed."
---

# Resolve PR Feedback

Address PR review comments systematically, resolving feedback in parallel where possible.

## Input

<pr_input> #$ARGUMENTS </pr_input>

## Workflow

### Step 1: Gather Feedback

Identify the PR and collect all pending review comments:
```bash
gh pr view --json reviewDecision,reviews,comments
```

### Step 2: Categorize Comments

- **Code changes needed** -- Requires implementation changes
- **Questions to answer** -- Needs a reply, not code
- **Suggestions to evaluate** -- Optional improvements to consider
- **Resolved** -- Already addressed or outdated

### Step 3: Plan Resolutions

For code change comments:
- Identify the affected files and lines
- Group related comments that can be addressed together
- Note any dependencies between comments

### Step 4: Execute

For independent comments, resolve in parallel:
- Make the requested code changes
- Reply to questions with explanations
- Accept or respectfully decline suggestions with reasoning

### Step 5: Verify and Push

- Run tests to ensure changes don't break anything
- Commit the fixes
- Push and reply to PR comments confirming resolution
