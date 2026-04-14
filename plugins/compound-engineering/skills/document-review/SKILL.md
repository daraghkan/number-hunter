---
name: document-review
description: "Review documents using parallel persona agents for role-specific feedback. Use when reviewing requirements docs, plans, or any written artifact that needs multi-perspective review."
---

# Document Review

Review documents using parallel persona agents for role-specific feedback.

## Input

<document_input> #$ARGUMENTS </document_input>

**If the input is empty, ask the user:** "Which document should I review? Provide a file path."

## Workflow

### Step 1: Read and Classify

Read the document and classify its type:
- **Requirements document** -- From brainstorming
- **Technical plan** -- From planning
- **API specification** -- Technical spec
- **Architecture decision** -- Design document
- **Other** -- General document

### Step 2: Select Reviewers

Based on document type, activate relevant persona agents:

**Always-on:**
- `coherence-reviewer` -- Internal consistency and terminology

**For requirements/plans:**
- `product-lens-reviewer` -- Problem framing and goal alignment
- `scope-guardian-reviewer` -- Scope creep and complexity
- `feasibility-reviewer` -- Technical feasibility
- `design-lens-reviewer` -- Missing design decisions
- `security-lens-reviewer` -- Security gaps

**For final review pass:**
- `adversarial-document-reviewer` -- Challenge premises and assumptions

### Step 3: Dispatch Reviewers

Launch selected reviewers as parallel sub-agents. Each receives:
- The full document content
- The document type classification
- Instructions to return structured findings

### Step 4: Merge and Present

Collect findings from all reviewers:
- Deduplicate overlapping findings
- Sort by severity (P0 > P1 > P2 > P3)
- Present in a structured table

### Step 5: Apply and Handoff

- Auto-apply non-controversial fixes (typos, formatting, terminology consistency)
- Present remaining findings for user decision
- Report "Review complete" when done
