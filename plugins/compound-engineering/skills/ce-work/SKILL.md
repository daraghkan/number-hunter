---
name: ce-work
description: "Execute work items systematically from plans or bare prompts. Use when you have a plan to implement, a feature to build, or any development work to execute with proper task tracking, testing, and incremental commits."
---

# Work Execution

Execute work efficiently while maintaining quality and finishing features.

This command takes a work document (plan, specification, or todo file) or a bare prompt describing the work, and executes it systematically. The focus is on **shipping complete features** by understanding requirements quickly, following existing patterns, and maintaining quality throughout.

## Input Document

<input_document> #$ARGUMENTS </input_document>

## Execution Workflow

### Phase 0: Input Triage

Determine how to proceed based on what was provided in `<input_document>`.

**Plan document** (input is a file path to an existing plan, specification, or todo file) -> skip to Phase 1.

**Bare prompt** (input is a description of work, not a file path):

1. **Scan the work area**
   - Identify files likely to change based on the prompt
   - Find existing test files for those areas
   - Note local patterns and conventions in the affected areas

2. **Assess complexity and route**

   | Complexity | Signals | Action |
   |-----------|---------|--------|
   | **Trivial** | 1-2 files, no behavioral change (typo, config, rename) | Proceed to Phase 1 step 2, then implement directly -- no task list |
   | **Small / Medium** | Clear scope, under ~10 files | Build a task list from discovery. Proceed to Phase 1 step 2 |
   | **Large** | Cross-cutting, architectural decisions, 10+ files | Inform the user this would benefit from `/ce:brainstorm` or `/ce:plan`. Honor their choice |

### Phase 1: Quick Start

1. **Read Plan and Clarify** _(skip if arriving from Phase 0 with a bare prompt)_
   - Read the work document completely
   - Treat the plan as a decision artifact, not an execution script
   - Check for `Execution note` on each implementation unit
   - Check for `Deferred to Implementation` or `Implementation-Time Unknowns` section
   - Check for `Scope Boundaries` section -- these are explicit non-goals
   - If anything is unclear or ambiguous, ask clarifying questions now
   - Get user approval to proceed

2. **Setup Environment**

   Check the current branch:
   ```bash
   current_branch=$(git branch --show-current)
   default_branch=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
   if [ -z "$default_branch" ]; then
     default_branch=$(git rev-parse --verify origin/main >/dev/null 2>&1 && echo "main" || echo "master")
   fi
   ```

   **If already on a feature branch**: Check whether the branch name is meaningful. If auto-generated or opaque, suggest renaming. Then ask: "Continue working on `[current_branch]`, or create a new branch?"

   **If on the default branch**, choose:
   - **Option A**: Create a new branch
   - **Option B**: Use a worktree (recommended for parallel development)
   - **Option C**: Continue on default branch (requires explicit user confirmation)

3. **Create Task List** _(skip if Phase 0 already built one, or if trivial)_
   - Break the plan into actionable tasks using available task tracking
   - Carry each unit's `Execution note` into the task when present
   - Include dependencies between tasks
   - Prioritize based on what needs to be done first
   - Include testing and quality check tasks

4. **Choose Execution Strategy**

   | Strategy | When to use |
   |----------|-------------|
   | **Inline** | 1-2 small tasks, or tasks needing user interaction. **Default for bare-prompt work** |
   | **Serial subagents** | 3+ tasks with dependencies. Each subagent gets fresh context focused on one unit |
   | **Parallel subagents** | 3+ tasks where some units have no shared dependencies and touch non-overlapping files |

### Phase 2: Execute

1. **Task Execution Loop**

   For each task in priority order:
   ```
   while (tasks remain):
     - Mark task as in-progress
     - Read any referenced files from the plan
     - Look for similar patterns in codebase
     - Find existing test files for implementation files being changed
     - Implement following existing conventions
     - Add, update, or remove tests to match implementation changes
     - Run tests after changes
     - Assess testing coverage
     - Mark task as completed
     - Evaluate for incremental commit
   ```

   When a unit carries an `Execution note`, honor it. For test-first units, write the failing test before implementation. For characterization-first units, capture existing behavior before changing it.

   **Test Discovery** -- Before implementing changes to a file, find its existing test files. Changes to implementation files should be accompanied by corresponding test updates.

   **System-Wide Test Check** -- Before marking a task done:
   - What fires when this runs? Trace callbacks, middleware, observers two levels out.
   - Do tests exercise the real chain? Write at least one integration test with real objects.
   - Can failure leave orphaned state?
   - What other interfaces expose this?
   - Do error strategies align across layers?

2. **Incremental Commits**

   | Commit when... | Don't commit when... |
   |----------------|---------------------|
   | Logical unit complete | Small part of a larger unit |
   | Tests pass + meaningful progress | Tests failing |
   | About to switch contexts | Purely scaffolding with no behavior |
   | About to attempt risky changes | Would need a "WIP" commit message |

   ```bash
   git add <files related to this logical unit>
   git commit -m "feat(scope): description of this unit"
   ```

3. **Follow Existing Patterns**
   - Read referenced similar code first
   - Match naming conventions exactly
   - Reuse existing components where possible
   - Follow project coding standards

4. **Test Continuously**
   - Run relevant tests after each significant change
   - Fix failures immediately
   - Add new tests for new behavior, update tests for changed behavior

5. **Track Progress**
   - Keep the task list updated
   - Note any blockers or unexpected discoveries
   - Create new tasks if scope expands

### Phase 3-4: Quality Check and Ship

When all Phase 2 tasks are complete:

1. **Run full test suite** -- Ensure nothing is broken
2. **Run linting** -- Follow project's lint configuration
3. **Self-review changes** -- Read through all diffs for obvious issues
4. **For simple additive work**: Inline review is sufficient
5. **For everything else**: Run `/ce:review` for comprehensive multi-agent review
6. **Create final commit** if uncommitted changes remain
7. **Push and create PR** or hand off to user

## Key Principles

- **Start Fast, Execute Faster** - Get clarification once at the start, then execute
- **The Plan is Your Guide** - Work documents reference similar code -- follow them
- **Test As You Go** - Run tests after each change, not at the end
- **Quality is Built In** - Follow patterns, write tests, run linting
- **Ship Complete Features** - Mark all tasks completed before moving on
