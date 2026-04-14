---
name: ce-plan
description: "Create structured implementation plans for any multi-step task. Use when you need to turn feature ideas, requirements docs, or problem descriptions into detailed technical plans with automatic confidence checking."
---

# Create Technical Plan

**Note: The current year is 2026.** Use this when dating plan documents.

ce:plan transforms requirements into implementation-ready technical plans. It defines **HOW** to build (complementing ce:brainstorm's **WHAT** and ce:work's **execution**).

**IMPORTANT: All file references in generated documents must use repo-relative paths (e.g., `src/models/user.rb`), never absolute paths. Absolute paths break portability across machines, worktrees, and teammates.**

## Input

<plan_input> #$ARGUMENTS </plan_input>

**If the input above is empty, ask the user:** "What would you like to plan? Provide a requirements document path, feature description, or problem to solve."

Do not proceed until you have input from the user.

## Execution Flow

### Phase 0: Resume, Source, and Scope

#### 0.1 Resume Existing Plans

If the user references an existing plan or there is an obvious recent matching `*-plan.md` file in `docs/plans/`:
- Read the document
- Confirm with the user: "Found an existing plan for [topic]. Should I continue from this, or start fresh?"
- If resuming and the request is to deepen, enter interactive deepening mode

#### 0.2 Source Requirements

Check for upstream requirements:
- If input is a file path to a requirements doc, read it
- If input is a feature description, check `docs/brainstorms/` for matching requirements
- If no requirements doc exists, assess whether to plan directly or suggest `/ce:brainstorm` first

#### 0.3 Classify Scope

- **Lightweight** - small, well-bounded, 1-3 implementation units
- **Standard** - normal feature, 3-8 implementation units
- **Deep** - cross-cutting, architectural, 8+ implementation units or high risk

### Phase 1: Gather Context

Run research appropriate to scope:

**All scopes:**
- Scan repo structure and conventions
- Read AGENTS.md for project guidance
- Search for similar patterns in codebase
- Check `docs/solutions/` for relevant learnings

**Standard and Deep additionally:**
- Analyze git history for the affected areas
- Research framework docs and best practices when touching unfamiliar territory
- Analyze user flows and edge cases

### Phase 2: Resolve Planning Questions

- Build question list from requirements and research gaps
- Distinguish planning-time decisions from implementation-time discoveries
- Ask users only when answers materially affect architecture or risk
- Use the platform's blocking question tool when available (`AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_user` in Gemini)

### Phase 3: Structure the Plan

**Title format:** `type: feature-name` (e.g., `feat: user-authentication`, `fix: email-validation`)

Break work into ordered, atomic **implementation units**. Each unit should have:

- **Goal**: What this unit accomplishes
- **Files**: Which files will be created or modified (repo-relative paths)
- **Approach**: How to implement it
- **Patterns to follow**: Existing code to mirror
- **Test scenarios**: Concrete inputs, actions, and expected outcomes
- **Verification**: How to confirm the unit is done
- **Execution note** (optional): Test-first, characterization-first, or other posture

### Phase 4: Write the Plan

Follow depth-appropriate templates:

**Lightweight:**
- Title, goal, 1-3 implementation units, key risks

**Standard:**
- Title, goal, scope boundaries, implementation units with full detail, dependencies, risks, test strategy

**Deep:**
- Everything in Standard plus: high-level technical design, architecture decisions with rationale, migration strategy, rollback plan

**Plan rules:**
- All file paths must be repo-relative
- Plans capture decisions and rationale, not implementation code
- Test scenarios must name specific inputs/outputs
- Feature-bearing units require actual test scenarios
- Never abandon the workflow -- if input is unclear, ask clarifying questions

### Phase 5: Final Review, Write File, and Handoff

1. Validate plan completeness against requirements
2. Run confidence check: rate confidence 1-5 on each unit
3. Write plan to `docs/plans/YYYY-MM-DD-NNN-<type>-<name>-plan.md`
4. Run document review on the plan

**Handoff options:**
1. **Execute it** -- Hand off to `/ce:work` with the plan
2. **Deepen the plan** -- Add more detail to low-confidence units
3. **Review it** -- Get feedback before executing
4. **Park it** -- Save for later execution
