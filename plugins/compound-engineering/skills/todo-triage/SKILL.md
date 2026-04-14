---
name: todo-triage
description: "Triage and prioritize pending todos. Use when you need to review, categorize, and prioritize TODO items in the codebase."
---

# Triage TODOs

Review, categorize, and prioritize TODO items in the codebase.

## Input

<triage_input> #$ARGUMENTS </triage_input>

## Workflow

### Step 1: Collect TODOs

Search for all TODO, FIXME, HACK, and XXX comments in the codebase.

### Step 2: Analyze Each TODO

For each item, determine:
- **Context** -- What code surrounds it? What feature/module does it belong to?
- **Age** -- When was it added? (check git blame)
- **Impact** -- What happens if it's not addressed?
- **Effort** -- How much work to resolve?
- **Dependencies** -- Does it block or depend on other work?

### Step 3: Categorize

| Priority | Criteria |
|----------|----------|
| **P0 - Critical** | Affects correctness, security, or data integrity |
| **P1 - High** | Affects user experience or performance |
| **P2 - Medium** | Technical debt that slows development |
| **P3 - Low** | Nice-to-have improvements |
| **Skip** | No longer relevant or too vague to act on |

### Step 4: Present

Output a prioritized list with recommendations:
- Which to resolve now (suggest `/todo-resolve`)
- Which to plan (suggest `/ce:plan`)
- Which to remove (stale or irrelevant)
