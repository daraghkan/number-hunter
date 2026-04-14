---
name: lfg
description: "Full autonomous engineering workflow. Use when you want end-to-end autonomous execution: brainstorm, plan, implement, review, and compound in one flow. Beta/experimental."
disable-model-invocation: true
---

# LFG - Full Autonomous Workflow

**Beta/Experimental** -- End-to-end autonomous engineering workflow.

Chains the full compound engineering workflow: brainstorm -> plan -> work -> review -> compound.

## Input

<lfg_input> #$ARGUMENTS </lfg_input>

## Workflow

### Step 1: Brainstorm
Run `/ce:brainstorm` with the input to clarify requirements. Auto-proceed with the recommended approach unless ambiguity requires user input.

### Step 2: Plan
Run `/ce:plan` with the requirements document from brainstorming. Auto-proceed with the generated plan.

### Step 3: Work
Run `/ce:work` with the plan to implement all changes.

### Step 4: Review
Run `/ce:review` on the completed work. Auto-fix safe issues.

### Step 5: Compound
If non-trivial learnings emerged, run `/ce:compound` to document them.

### Step 6: Ship
Push changes and create a PR.

## Key Rules

- Stop and ask the user at any decision point with high ambiguity
- Auto-proceed through low-ambiguity steps to maintain flow
- If any phase fails or produces low-confidence output, pause and report
