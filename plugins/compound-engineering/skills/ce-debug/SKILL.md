---
name: ce-debug
description: "Systematically find root causes and fix bugs. Use when debugging errors, unexpected behavior, test failures, or any issue that needs methodical investigation. Traces causal chains, forms testable hypotheses, and implements test-first fixes."
---

# Debug

Systematically find root causes and fix bugs using structured investigation, hypothesis testing, and test-first fixes.

## Input

<debug_input> #$ARGUMENTS </debug_input>

**If the debug input above is empty, ask the user:** "What bug or issue are you seeing? Describe the symptoms, error messages, or unexpected behavior."

## Execution Flow

### Phase 0: Triage

1. **Classify the issue:**
   - Error message / stack trace
   - Unexpected behavior (works but wrong output)
   - Performance degradation
   - Test failure
   - Intermittent / flaky

2. **Assess severity and scope:**
   - Is production affected?
   - How many users/features impacted?
   - Is there a workaround?

3. **Check for quick wins:**
   - Is this a known issue in `docs/solutions/`?
   - Has this been fixed before? (search git history)
   - Is there an obvious typo or config error?

If a quick win is found, apply it, verify, and skip to Phase 4.

### Phase 1: Investigate

**Rule: Investigate before fixing.** Do not attempt fixes until the root cause is understood.

1. **Reproduce the bug:**
   - Identify the minimal reproduction steps
   - Confirm the bug exists in the current state
   - Note exact error messages, stack traces, and behavior

2. **Trace the code path:**
   - Start from the symptom (error location, failing test, UI behavior)
   - Read the code path top-to-bottom
   - Identify the inputs, transformations, and outputs at each step
   - Note where actual behavior diverges from expected behavior

3. **Gather evidence:**
   - Read relevant source files
   - Check recent git changes to affected files: `git log --oneline -10 -- <file>`
   - Look for related test files
   - Check configuration and environment state

### Phase 2: Root Cause

1. **Form hypotheses:**
   For each hypothesis:
   - State the hypothesis clearly
   - Make a **prediction** -- what specific thing would be true if this hypothesis is correct?
   - Test the prediction (read code, run test, check state)
   - Confirm or eliminate the hypothesis

2. **Causal chain gate:**
   Before proceeding to fix, verify:
   - Can you trace the full chain from root cause to symptom?
   - Does the root cause explain ALL observed symptoms?
   - Are there any unexplained symptoms remaining?

   If the causal chain is incomplete, return to investigation.

3. **Smart escalation:**
   If stuck after 3 hypotheses:
   - Widen the search (check adjacent systems, recent deploys, dependencies)
   - Look for environmental factors (config, data state, timing)
   - Ask the user for additional context

### Phase 3: Fix

**Rule: One change at a time.**

1. **Workspace safety check:**
   - Ensure you're on an appropriate branch
   - Check for uncommitted changes that should be stashed

2. **Write the failing test first:**
   - Write a test that reproduces the bug
   - Verify the test fails for the expected reason
   - The test should pass once the fix is applied

3. **Implement the minimal fix:**
   - Fix the root cause, not the symptom
   - Make the smallest change that resolves the issue
   - Do not refactor or improve adjacent code

4. **Verify the fix:**
   - Run the new test -- it should pass
   - Run the full relevant test suite -- no regressions
   - Manually verify if applicable

### Phase 4: Close

1. **Structured summary:**
   ```
   Bug: [one-line description]
   Root cause: [what was actually wrong]
   Fix: [what was changed and why]
   Tests: [what test coverage was added]
   ```

2. **Handoff options:**
   - **Commit the fix** -- Create a commit with the fix
   - **Document it** -- Run `/ce:compound` to capture the learning
   - **Review it** -- Run `/ce:review` before merging
   - **Continue** -- Return to previous workflow

## Key Principles

- **Investigate before fixing** -- Understand the root cause before writing any fix
- **One change at a time** -- Isolate variables to confirm causation
- **Test-first fixes** -- Write the failing test before implementing the fix
- **Trace the full chain** -- From root cause through every step to the symptom
- **Don't fix symptoms** -- Address root causes, not surface-level effects
