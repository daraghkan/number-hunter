---
name: ce-optimize
description: "Run iterative optimization loops with parallel experiments, measurement gates, and quality scoring. Use when you need to systematically improve performance, quality, or any measurable metric through hypothesis-driven experimentation."
---

# Optimize

Run metric-driven iterative optimization loops with parallel experiments, measurement gates, and LLM-as-judge quality scoring.

## Input

<optimize_input> #$ARGUMENTS </optimize_input>

**If the input above is empty, ask the user:** "What would you like to optimize? Describe the metric, goal, and any constraints."

## Types

- **Hard metrics** -- Measurable with code (latency, throughput, bundle size, test pass rate)
- **Judge metrics** -- Evaluated by LLM-as-judge (code quality, readability, documentation clarity)

## Execution Flow

### Phase 0: Setup

1. **Determine input type:**
   - Existing optimization spec file
   - Bare description of what to optimize

2. **Load or create spec:**
   - Identify metric type (hard vs. judge)
   - Define success criteria and stopping conditions
   - Set baseline expectations

3. **Search prior learnings:**
   - Check `docs/solutions/` for related optimization work
   - Review git history for previous attempts

4. **Create optimization branch:**
   ```bash
   git checkout -b optimize/<metric-name>
   ```

### Phase 1: Measurement Scaffolding

1. **Build measurement harness:**
   - Create or identify the script/command that measures the metric
   - Validate the harness produces consistent results
   - Handle both hard and judge metric types

2. **Establish baseline:**
   - Run the measurement harness on current state
   - Record baseline value with metadata (timestamp, commit, environment)
   - Save as checkpoint CP-0

3. **User approval gate:**
   - Present baseline and optimization plan
   - Get confirmation before proceeding with experiments

### Phase 2: Hypothesis Generation

Generate improvement hypotheses based on:
- Codebase analysis
- Known optimization patterns
- Prior learnings from `docs/solutions/`
- Profiling data (if available)

Rank hypotheses by expected impact and implementation effort.

### Phase 3: Optimization Loop

```
while (not stopping_criteria_met):
  1. Select next batch of hypotheses
  2. Implement each experiment (in worktrees if parallel)
  3. Measure results
  4. Compare against baseline and best-so-far
  5. Persist results as checkpoints
  6. Accept or reject each experiment
  7. Update hypotheses based on learnings
```

**Stopping criteria:**
- Target metric achieved
- Diminishing returns (last N experiments < threshold improvement)
- Maximum iteration count reached
- User requests stop

### Phase 4: Wrap-Up

1. **Merge winning experiments** into the optimization branch
2. **Write optimization report** with before/after metrics
3. **Document learnings** via `/ce:compound` if significant
4. **Handoff options:**
   - Review changes with `/ce:review`
   - Merge to main branch
   - Continue optimizing
