---
name: ce-ideate
description: "Discover high-impact project improvements through divergent ideation and adversarial filtering. Use when you want to surface strong improvement ideas grounded in your actual codebase, not abstract advice."
---

# Ideate Improvements

Generate and evaluate improvement ideas for the project by grounding suggestions in actual codebase context rather than abstract advice.

## Input

<ideation_input> #$ARGUMENTS </ideation_input>

## Execution Flow

### Phase 0: Setup and Resume

- Scan for recent ideation work in `docs/ideation/`
- Interpret focus and volume parameters from user input
- Distinguish between general ideation and issue-tracker-driven requests

### Phase 1: Gather Codebase Context

Run parallel research agents to examine:
- Project structure and architecture
- Past learnings from `docs/solutions/`
- Git history for recent change patterns
- (Conditionally) GitHub issues for recurring themes
- (Conditionally) Slack signals if tools available and user requests

Consolidate results into a grounding summary.

### Phase 2: Divergent Ideation

Dispatch 3-4 ideation sub-agents using different frames:
- **User friction** -- What causes the most pain for users?
- **Inversion/removal** -- What if we removed this instead of adding to it?
- **Assumption-breaking** -- What assumptions are we making that might be wrong?
- **Leverage effects** -- What small change would create the biggest ripple?

Each agent generates ~8-10 raw candidates. Merge, deduplicate, and synthesize cross-cutting combinations before critique.

When issue-tracker intent is detected, GitHub themes guide frame selection.
Volume hints (e.g., "top 3", "100 ideas") adjust both generation targets and survivor counts.

### Phase 3: Adversarial Filtering

Apply explicit rejection with reasons over optimistic ranking:
- Challenge each idea's assumptions
- Assess feasibility and carrying cost
- Score impact vs. effort
- Reject weak ideas with clear reasoning

### Phase 4: Rank and Present

Present surviving ideas ranked by impact, with:
- Clear description of the improvement
- Why it matters (grounded in codebase evidence)
- Estimated effort and complexity
- Dependencies or prerequisites
- Recommended next step (brainstorm, plan, or direct work)

### Phase 5: Write Artifact

Write the ranked ideation artifact to `docs/ideation/YYYY-MM-DD-[topic]-ideation.md`.

## Key Principles

- **Ground before ideating** -- Scan the actual repository first
- **Explicit rejection** -- Reject weak ideas with reasons, don't just rank
- **Push past obvious** -- Generate many candidates before filtering to find stronger threads
- **Ideation identifies directions** -- Downstream `/ce:brainstorm` defines chosen ideas precisely

## Handoff Options

1. **Brainstorm the top idea** -- Hand off to `/ce:brainstorm`
2. **Plan directly** -- Hand off to `/ce:plan` if the idea is well-defined
3. **Explore more** -- Continue ideation with different frames
4. **Park it** -- Save the artifact for later
