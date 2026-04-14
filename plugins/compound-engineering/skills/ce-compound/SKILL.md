---
name: ce-compound
description: "Document solved problems to compound team knowledge. Use after fixing a bug, solving a non-trivial problem, or discovering a best practice worth preserving. Creates structured documentation in docs/solutions/ with YAML frontmatter for searchability."
---

# Compound Knowledge

Coordinate multiple subagents working in parallel to document a recently solved problem.

## Purpose

Captures problem solutions while context is fresh, creating structured documentation in `docs/solutions/` with YAML frontmatter for searchability and future reference. Uses parallel subagents for maximum efficiency.

**Why "compound"?** Each documented solution compounds your team's knowledge. The first time you solve a problem takes research. Document it, and the next occurrence takes minutes. Knowledge compounds.

## Usage

```bash
/ce:compound                    # Document the most recent fix
/ce:compound [brief context]    # Provide additional context hint
```

## Execution Strategy

Present the user with two options before proceeding, using the platform's blocking question tool (`AskUserQuestion` in Claude Code, `request_user_input` in Codex, `ask_user` in Gemini).

```
1. Full (recommended) -- the complete compound workflow. Researches,
   cross-references, and reviews your solution to produce documentation
   that compounds your team's knowledge.

2. Lightweight -- same documentation, single pass. Faster and uses
   fewer tokens, but won't detect duplicates or cross-reference
   existing docs. Best for simple fixes or long sessions nearing
   context limits.
```

Do NOT pre-select a mode. Wait for the user's choice before proceeding.

### Full Mode

**The primary output is ONE file - the final documentation.**

Phase 1 subagents return TEXT DATA to the orchestrator. They must NOT create any files. Only the orchestrator writes files.

### Phase 1: Research

Launch research subagents in parallel:

#### 1. Context Analyzer
- Extracts conversation history
- Determines the track (bug or knowledge) from the problem_type
- Identifies problem type, component, and track-appropriate fields:
  - **Bug track**: symptoms, root_cause, resolution_type
  - **Knowledge track**: applies_when
- Suggests a filename using the pattern `[sanitized-problem-slug]-[date].md`
- Returns: YAML frontmatter skeleton, category directory path, suggested filename

#### 2. Solution Extractor
- Adapts output structure based on the problem_type track

  **Bug track sections:**
  - Problem, Symptoms, What Didn't Work, Solution, Why This Works, Prevention

  **Knowledge track sections:**
  - Context, Guidance, Why This Matters, When to Apply, Examples

#### 3. Related Docs Finder
- Searches `docs/solutions/` for related documentation
- Identifies cross-references and links
- Assesses overlap with the new doc across five dimensions
- Returns: Links, relationships, overlap assessment

### Phase 2: Assembly and Write

1. Collect all text results from Phase 1 subagents
2. Check overlap assessment:
   - **High overlap** -- Update the existing doc rather than creating a duplicate
   - **Moderate overlap** -- Create new doc, flag for consolidation review
   - **Low or none** -- Create new doc normally
3. Assemble complete markdown file
4. Validate YAML frontmatter
5. Create directory: `mkdir -p docs/solutions/[category]/`
6. Write the file

### Phase 2.5: Selective Refresh Check

Decide whether older docs should be refreshed based on the new learning. Invoke `ce:compound-refresh` selectively when the new learning contradicts or supersedes existing docs.

### Discoverability Check

Verify that project instruction files would lead agents to discover `docs/solutions/`. If not, propose a small addition to AGENTS.md or CLAUDE.md.

### Phase 3: Optional Enhancement

Based on problem type, invoke specialized review agents:
- **performance_issue** -> `performance-oracle`
- **security_issue** -> `security-sentinel`
- **database_issue** -> `data-integrity-guardian`
- Code-heavy issues -> `code-simplicity-reviewer` + stack-appropriate reviewer

### Lightweight Mode

Single-pass alternative -- same documentation, fewer tokens:
1. Extract from conversation
2. Classify track, category, and filename
3. Write minimal doc with track-appropriate sections
4. Skip specialized reviews

## What It Creates

**File:** `docs/solutions/[category]/[filename].md`

**Bug track categories:**
- build-errors/, test-failures/, runtime-errors/, performance-issues/
- database-issues/, security-issues/, ui-bugs/, integration-issues/, logic-errors/

**Knowledge track categories:**
- best-practices/, workflow-issues/, developer-experience/, documentation-gaps/

## The Compounding Philosophy

```
Build -> Test -> Find Issue -> Research -> Improve -> Document -> Validate -> Deploy
    ^                                                                          |
    +--------------------------------------------------------------------------+
```

**Each unit of engineering work should make subsequent units of work easier -- not harder.**

## Auto-Invoke

Trigger phrases: "that worked", "it's fixed", "working now", "problem solved"

Use `/ce:compound [context]` to document immediately without waiting for auto-detection.
