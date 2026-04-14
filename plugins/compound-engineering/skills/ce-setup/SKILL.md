---
name: ce-setup
description: "Diagnose environment, install missing tools, and bootstrap project config. Use when setting up compound-engineering in a new project or troubleshooting environment issues."
---

# Setup

Diagnose your environment, install missing tools, and bootstrap project configuration for compound-engineering workflows.

## Execution Flow

### Phase 1: Diagnose

1. **Determine plugin version:**
   - Check installed plugin version
   - Compare with latest available version
   - Report if an update is available

2. **Run health checks:**
   - Git configuration (user.name, user.email)
   - Required CLI tools: `git`, `gh` (GitHub CLI), `jq`
   - Optional CLI tools: `vhs` (terminal recording), `silicon` (code screenshots), `ffmpeg` (media processing)
   - Node.js / Bun runtime availability
   - Project-specific requirements

3. **Evaluate results:**
   - Classify each check as: pass, warning, or fail
   - Group by priority (required vs. optional)

### Phase 2: Fix

1. **Resolve repo-local issues:**
   - Create missing directories (`docs/brainstorms/`, `docs/plans/`, `docs/solutions/`)
   - Initialize AGENTS.md if missing
   - Set up .gitignore entries for compound-engineering artifacts

2. **Bootstrap project config:**
   - Create `.compound-engineering/` config directory if needed
   - Generate default `config.local.yaml` (gitignored, machine-local settings)

3. **Offer tool installation:**
   For each missing optional tool, offer to install:
   ```
   Missing: gh (GitHub CLI)
   Install? This enables PR creation, issue linking, and GitHub integration.
   [Yes / No / Skip all optional]
   ```

4. **Summary:**
   ```
   Environment Status:
   - Required tools: X/Y installed
   - Optional tools: X/Y installed
   - Project config: bootstrapped / already configured
   - Plugin version: X.Y.Z (latest: A.B.C)

   Next steps:
   1. Run /ce:brainstorm to explore a new feature
   2. Run /ce:plan to create an implementation plan
   3. Run /ce:work to execute existing plans
   ```
