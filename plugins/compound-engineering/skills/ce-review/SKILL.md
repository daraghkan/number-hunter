---
name: ce-review
description: "Structured multi-agent code review with tiered persona agents, confidence gating, and dedup pipeline. Use before merging PRs or when you want comprehensive code review with automatic fix application."
---

# Code Review

Structured code review using tiered reviewer agents, confidence-gated findings, and a merge/dedup pipeline for pre-PR analysis.

## Modes

1. **Interactive** (default) -- applies safe fixes automatically, asks policy questions on gated/manual findings, offers next-step options
2. **Autofix** -- non-interactive, applies only safe fixes, writes artifacts and todos for residual work
3. **Report-only** -- read-only review with no mutations or artifact files
4. **Headless** -- programmatic mode returning structured JSON, single-pass safe fixes, no user prompts

## Input

<review_input> #$ARGUMENTS </review_input>

## Execution Pipeline

### Stage 1: Determine Scope

Compute diff using one of these methods (in priority order):
- `base:` argument specifying the base branch
- PR metadata if on a PR branch
- Current branch vs default branch

```bash
default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
if [ -z "$default_branch" ]; then
  default_branch=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo "main" || echo "master")
fi
git diff "$default_branch"...HEAD --stat
```

Validate worktree cleanliness before switching branches.

### Stage 2: Intent Discovery

Extract the goal from:
- PR title/body
- Commit messages on the branch
- Branch name
- User-provided context

In interactive mode, ask clarifying questions if the intent is ambiguous.

### Stage 2b: Plan Discovery

Locate optional requirements/plan document via:
- `plan:` argument
- PR body scan for doc links
- Auto-discovery in `docs/plans/` or `docs/brainstorms/`

### Stage 3: Select Reviewers

**Always-on personas (4):**
- `correctness-reviewer` -- Logic errors, edge cases, state bugs
- `testing-reviewer` -- Test coverage gaps, weak assertions
- `maintainability-reviewer` -- Coupling, complexity, naming, dead code
- `project-standards-reviewer` -- CLAUDE.md and AGENTS.md compliance

**Conditionally activated (based on diff content):**
- `security-reviewer` -- When touching auth, crypto, user input, API keys
- `performance-reviewer` -- When touching queries, loops, caching, rendering
- `data-migrations-reviewer` -- When touching database migrations
- `reliability-reviewer` -- When touching error handling, retries, external services
- `architecture-strategist` -- When touching module boundaries, APIs, abstractions
- `code-simplicity-reviewer` -- Final pass for simplicity and minimalism
- `adversarial-reviewer` -- Construct failure scenarios across component boundaries

**Stack-specific (conditionally):**
- `dhh-rails-reviewer` -- Rails code
- `kieran-rails-reviewer` -- Rails with strict conventions
- `kieran-python-reviewer` -- Python with strict conventions
- `kieran-typescript-reviewer` -- TypeScript with strict conventions

### Stage 3b: Discover Standards Paths

Glob for `CLAUDE.md` and `AGENTS.md` files governing changed code, pass paths to project-standards persona.

### Stage 4: Spawn Sub-Agents

Dispatch all selected reviewers as parallel sub-agents:
- Pass diff scope, intent, PR metadata, and run ID
- Each agent writes full-detail JSON artifact and returns compact merge-tier JSON

### Stage 5: Merge Findings

- Suppress findings below 0.60 confidence (P0 at 0.50+ retained)
- Deduplicate by fingerprint (file + line +/- 3 bucket + normalized title)
- Boost confidence on cross-reviewer agreement
- Resolve disagreements conservatively
- Partition into: fixer queue / residual actionable / report-only

**Severity scale:**
- P0: Critical -- must fix before merge
- P1: High-impact -- strongly recommended
- P2: Moderate -- worth addressing
- P3: Low-impact -- nice to have

**Autofix classes:**
- `safe_auto` -- In-skill fix, no behavior change
- `gated_auto` -- Behavior-changing, needs approval
- `manual` -- Requires human judgment
- `advisory` -- Report-only observation

### Stage 6: Synthesize and Present

Assemble findings into pipe-delimited markdown tables grouped by severity.

**Verdict options:**
- **Ready to merge** -- No P0/P1 findings
- **Ready with fixes** -- Only safe_auto fixes needed
- **Not ready** -- P0/P1 findings requiring attention

### Post-Review Flow

**Interactive:**
- Apply safe fixes automatically
- Ask policy question only if gated/manual remains
- Offer commit/push/PR options

**Autofix:**
- Apply safe fixes, write artifacts and todos
- No user prompts

**Report-only:**
- Stop after report

**Headless:**
- Apply safe fixes in one pass
- Return structured JSON envelope

All modes skip the fix/handoff phase if the review is clean.

## Key Constraints

- **Accuracy gates:** Verify line numbers, eliminate false positives, calibrate severity
- **Finding quality:** Every finding must be actionable with a concrete fix
- **Protected artifacts:** Never recommend deleting files in `docs/brainstorms/`, `docs/plans/`, or `docs/solutions/`
