---
name: ce-brainstorm
description: "Explore requirements and approaches before planning. Use when starting a new feature, improvement, or any work that benefits from collaborative requirement exploration before jumping to implementation."
---

# Brainstorm a Feature or Improvement

**Note: The current year is 2026.** Use this when dating requirements documents.

Brainstorming helps answer **WHAT** to build through collaborative dialogue. It precedes `/ce:plan`, which answers **HOW** to build it.

The durable output of this workflow is a **requirements document**. In this context, keep the workflow name `brainstorm`, but make the written artifact strong enough that planning does not need to invent product behavior, scope boundaries, or success criteria.

This skill does not implement code. It explores, clarifies, and documents decisions for later planning or execution.

**IMPORTANT: All file references in generated documents must use repo-relative paths (e.g., `src/models/user.rb`), never absolute paths. Absolute paths break portability across machines, worktrees, and teammates.**

## Core Principles

1. **Assess scope first** - Match the amount of ceremony to the size and ambiguity of the work.
2. **Be a thinking partner** - Suggest alternatives, challenge assumptions, and explore what-ifs instead of only extracting requirements.
3. **Resolve product decisions here** - User-facing behavior, scope boundaries, and success criteria belong in this workflow. Detailed implementation belongs in planning.
4. **Keep implementation out of the requirements doc by default** - Do not include libraries, schemas, endpoints, file layouts, or code-level design unless the brainstorm itself is inherently about a technical or architectural change.
5. **Right-size the artifact** - Simple work gets a compact requirements document or brief alignment. Larger work gets a fuller document. Do not add ceremony that does not help planning.
6. **Apply YAGNI to carrying cost, not coding effort** - Prefer the simplest approach that delivers meaningful value. Avoid speculative complexity and hypothetical future-proofing, but low-cost polish or delight is worth including when its ongoing cost is small and easy to maintain.

## Interaction Rules

1. **Ask one question at a time** - Do not batch several unrelated questions into one message.
2. **Prefer single-select multiple choice** - Use single-select when choosing one direction, one priority, or one next step.
3. **Use multi-select rarely and intentionally** - Use it only for compatible sets such as goals, constraints, non-goals, or success criteria that can all coexist. If prioritization matters, follow up by asking which selected item is primary.
4. **Use the platform's question tool when available** - When asking the user a question, prefer the platform's blocking question tool if one exists (`AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_user` in Gemini). Otherwise, present numbered options in chat and wait for the user's reply before proceeding.

## Output Guidance

- **Keep outputs concise** - Prefer short sections, brief bullets, and only enough detail to support the next decision.
- **Use repo-relative paths** - When referencing files, use paths relative to the repo root (e.g., `src/models/user.rb`), never absolute paths. Absolute paths make documents non-portable across machines and teammates.

## Feature Description

<feature_description> #$ARGUMENTS </feature_description>

**If the feature description above is empty, ask the user:** "What would you like to explore? Please describe the feature, problem, or improvement you're thinking about."

Do not proceed until you have a feature description from the user.

## Execution Flow

### Phase 0: Resume, Assess, and Route

#### 0.1 Resume Existing Work When Appropriate

If the user references an existing brainstorm topic or document, or there is an obvious recent matching `*-requirements.md` file in `docs/brainstorms/`:
- Read the document
- Confirm with the user before resuming: "Found an existing requirements doc for [topic]. Should I continue from this, or start fresh?"
- If resuming, summarize the current state briefly, continue from its existing decisions and outstanding questions, and update the existing document instead of creating a duplicate

#### 0.1b Classify Task Domain

Before proceeding to Phase 0.2, classify whether this is a software task. The key question is: **does the task involve building, modifying, or architecting software?** -- not whether the task *mentions* software topics.

**Software** (continue to Phase 0.2) -- the task references code, repositories, APIs, databases, or asks to build/modify/debug/deploy software.

**Non-software brainstorming** (route to universal brainstorming) -- BOTH conditions must be true:
- None of the software signals above are present
- The task describes something the user wants to explore, decide, or think through in a non-software domain

**Neither** (respond directly, skip all brainstorming phases) -- the input is a quick-help request, error message, factual question, or single-step task that doesn't need a brainstorm.

**If non-software brainstorming is detected:** Read `references/universal-brainstorming.md` and use those facilitation principles to brainstorm with the user naturally. Do not follow the software brainstorming phases below.

#### 0.2 Assess Whether Brainstorming Is Needed

**Clear requirements indicators:**
- Specific acceptance criteria provided
- Referenced existing patterns to follow
- Described exact expected behavior
- Constrained, well-defined scope

**If requirements are already clear:**
Keep the interaction brief. Confirm understanding and present concise next-step options rather than forcing a long brainstorm. Only write a short requirements document when a durable handoff to planning or later review would be valuable. Skip Phase 1.1 and 1.2 entirely -- go straight to Phase 1.3 or Phase 3.

#### 0.3 Assess Scope

Use the feature description plus a light repo scan to classify the work:
- **Lightweight** - small, well-bounded, low ambiguity
- **Standard** - normal feature or bounded refactor with some decisions to make
- **Deep** - cross-cutting, strategic, or highly ambiguous

If the scope is unclear, ask one targeted question to disambiguate and then proceed.

### Phase 1: Understand the Idea

#### 1.1 Existing Context Scan

Scan the repo before substantive brainstorming. Match depth to scope:

**Lightweight** -- Search for the topic, check if something similar already exists, and move on.

**Standard and Deep** -- Two passes:

*Constraint Check* -- Check project instruction files (`AGENTS.md`, and `CLAUDE.md` only if retained as compatibility context) for workflow, product, or scope constraints that affect the brainstorm. If these add nothing, move on.

*Topic Scan* -- Search for relevant terms. Read the most relevant existing artifact if one exists (brainstorm, plan, spec, skill, feature doc). Skim adjacent examples covering similar behavior.

If nothing obvious appears after a short scan, say so and continue.

1. **Verify before claiming** -- When the brainstorm touches checkable infrastructure (database tables, routes, config files, dependencies, model definitions), read the relevant source files to confirm what actually exists. Any claim that something is absent must be verified against the codebase first; if not verified, label it as an unverified assumption.

2. **Defer design decisions to planning** -- Implementation details like schemas, migration strategies, endpoint structure, or deployment topology belong in planning, not here -- unless the brainstorm is itself about a technical or architectural decision.

#### 1.2 Product Pressure Test

Before generating approaches, challenge the request to catch misframing. Match depth to scope:

**Lightweight:**
- Is this solving the real user problem?
- Are we duplicating something that already covers this?
- Is there a clearly better framing with near-zero extra cost?

**Standard:**
- Is this the right problem, or a proxy for a more important one?
- What user or business outcome actually matters here?
- What happens if we do nothing?
- Is there a nearby framing that creates more user value without more carrying cost?
- Given the current project state, user goal, and constraints, what is the single highest-leverage move right now?
- Favor moves that compound value, reduce future carrying cost, or make the product meaningfully more useful or compelling

**Deep** -- Standard questions plus:
- What durable capability should this create in 6-12 months?
- Does this move the product toward that, or is it only a local patch?

#### 1.3 Collaborative Dialogue

Follow the Interaction Rules above. Use the platform's blocking question tool when available.

**Guidelines:**
- Ask what the user is already thinking before offering your own ideas
- Start broad (problem, users, value) then narrow (constraints, exclusions, edge cases)
- Clarify the problem frame, validate assumptions, and ask about success criteria
- Make requirements concrete enough that planning will not need to invent behavior
- Surface dependencies or prerequisites only when they materially affect scope
- Resolve product decisions here; leave technical implementation choices for planning
- Bring ideas, alternatives, and challenges instead of only interviewing

**Exit condition:** Continue until the idea is clear OR the user explicitly wants to proceed.

### Phase 2: Explore Approaches

If multiple plausible directions remain, propose **2-3 concrete approaches** based on research and conversation. Otherwise state the recommended direction directly.

Use at least one non-obvious angle -- inversion (what if we did the opposite?), constraint removal (what if X weren't a limitation?), or analogy from how another domain solves this.

Present approaches first, then evaluate. Let the user see all options before hearing which one is recommended.

For each approach, provide:
- Brief description (2-3 sentences)
- Pros and cons
- Key risks or unknowns
- When it's best suited

After presenting all approaches, state your recommendation and explain why.

If one approach is clearly best and alternatives are not meaningful, skip the menu and state the recommendation directly.

### Phase 3: Capture the Requirements

Write or update a requirements document only when the conversation produced durable decisions worth preserving. Read `references/requirements-capture.md` for the document template, formatting rules, visual aid guidance, and completeness checks.

For **Lightweight** brainstorms, keep the document compact. Skip document creation when the user only needs brief alignment and no durable decisions need to be preserved.

### Phase 3.5: Document Review

When a requirements document was created or updated, run the `document-review` skill on it before presenting handoff options.

If document-review returns findings that were auto-applied, note them briefly when presenting handoff options. If residual P0/P1 findings were surfaced, mention them so the user can decide whether to address them before proceeding.

### Phase 4: Handoff

Present next-step options:

1. **Plan it** -- Hand off to `/ce:plan` with the requirements document
2. **Work on it directly** -- Hand off to `/ce:work` if scope is small enough
3. **Continue brainstorming** -- Keep refining requirements
4. **Park it** -- Save the requirements document for later

Execute the user's selection.
