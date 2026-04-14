---
name: todo-resolve
description: "Resolve todos in parallel. Use when you have pending TODO items in the codebase that need to be addressed systematically."
---

# Resolve TODOs

Find and resolve TODO comments in the codebase systematically.

## Input

<todo_input> #$ARGUMENTS </todo_input>

## Workflow

### Step 1: Find TODOs

Search for TODO, FIXME, HACK, and XXX comments:
- Scope to specific files/directories if provided
- Otherwise scan the full codebase

### Step 2: Categorize and Prioritize

- **Quick fixes** -- Can be resolved immediately (< 5 min each)
- **Implementation needed** -- Requires meaningful code changes
- **Design decisions** -- Needs user input or architectural choice
- **Out of scope** -- Should remain as TODOs

### Step 3: Execute

Resolve quick fixes and implementation items in parallel where possible:
- Address each TODO with a proper implementation
- Remove the TODO comment once resolved
- Add tests if the fix adds behavior

### Step 4: Report

Present a summary of what was resolved and what remains.
