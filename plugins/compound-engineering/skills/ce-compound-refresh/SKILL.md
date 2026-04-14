---
name: ce-compound-refresh
description: "Refresh stale or drifting learnings in docs/solutions/ and decide whether to keep, update, replace, or archive them. Use when existing documentation may be outdated due to code changes, refactors, or new patterns."
---

# Compound Refresh

Maintain the quality of `docs/solutions/` over time by refreshing stale or drifting learnings.

## Input

<refresh_input> #$ARGUMENTS </refresh_input>

**If the input is empty, ask the user:** "What area should I check for stale documentation? Provide a file path, module name, category, or topic."

## Modes

- **Interactive** (default) -- Present findings and ask before making changes
- **Autofix** -- Apply non-breaking updates automatically, report the rest

## Maintenance Actions

| Action | When to use |
|--------|------------|
| **Keep** | Learning is still accurate and useful |
| **Update** | Core guidance is right but details need refreshing |
| **Consolidate** | Multiple docs cover the same topic, merge into one |
| **Replace** | Learning is fundamentally wrong, rewrite from scratch |
| **Delete** | Learning is obsolete or harmful, remove entirely |

## Execution Flow

### Phase 0: Assess and Route

1. Parse scope from input (specific file, module, category, or broad)
2. Identify candidate documents to review
3. Determine refresh depth based on scope

### Phase 1: Investigate Candidates

For each candidate document:
1. Read the full document
2. Check referenced code -- do the files, functions, and patterns still exist?
3. Check git history -- has the referenced code changed significantly since the doc was written?
4. Classify drift:
   - **None** -- Still accurate
   - **Minor** -- Small details outdated but core guidance holds
   - **Major** -- Significant code changes invalidate key points
   - **Obsolete** -- Referenced code/patterns no longer exist

### Phase 1.5: Pattern Docs

If the scope includes pattern documentation, also check:
- Are the patterns still followed in the codebase?
- Have new patterns emerged that supersede documented ones?
- Are there contradictions between pattern docs and solution docs?

### Phase 2: Classify Actions

Map each candidate to a maintenance action based on drift assessment.

### Phase 3: Present and Decide

**Interactive mode:**
- Present each finding with evidence
- Ask the user to confirm the action
- Use the platform's blocking question tool

**Autofix mode:**
- Apply Keep and minor Update actions automatically
- Report Major/Obsolete findings for manual review

### Phase 4: Execute

Apply the confirmed actions:
- **Keep**: No changes
- **Update**: Edit the document with refreshed details, add `last_updated` field
- **Consolidate**: Merge documents, redirect or delete duplicates
- **Replace**: Write new document, archive or delete the old one
- **Delete**: Remove the document

### Phase 5: Commit Changes

Create a commit with the refresh changes:
```bash
git add docs/solutions/
git commit -m "docs: refresh stale learnings in [scope]"
```

## Output

```
Refresh complete for [scope]:
- Kept: N documents (still accurate)
- Updated: N documents (minor refreshes)
- Consolidated: N documents merged into M
- Replaced: N documents
- Deleted: N documents

Files changed:
- [list of modified/deleted files]
```
