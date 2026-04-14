# Compound Engineering Plugin

AI-powered development tools that get smarter with every use. Make each unit of engineering work easier than the last.

## Getting Started

After installing, run `/ce-setup` in any project. It diagnoses your environment, installs missing tools, and bootstraps project config in one interactive flow.

## Components

| Component | Count |
|-----------|-------|
| Agents | 50+ |
| Skills | 41+ |

## Skills

### Core Workflow

The primary entry points for engineering work, invoked as slash commands:

| Skill | Description |
|-------|-------------|
| `/ce:ideate` | Discover high-impact project improvements through divergent ideation and adversarial filtering |
| `/ce:brainstorm` | Explore requirements and approaches before planning |
| `/ce:plan` | Create structured plans for any multi-step task with automatic confidence checking |
| `/ce:review` | Structured code review with tiered persona agents, confidence gating, and dedup pipeline |
| `/ce:work` | Execute work items systematically |
| `/ce-debug` | Systematically find root causes and fix bugs |
| `/ce:compound` | Document solved problems to compound team knowledge |
| `/ce:compound-refresh` | Refresh stale or drifting learnings and decide whether to keep, update, replace, or archive them |
| `/ce-optimize` | Run iterative optimization loops with parallel experiments, measurement gates, and quality scoring |

### Git Workflow

| Skill | Description |
|-------|-------------|
| `git-commit` | Create a git commit with a value-communicating message |
| `git-commit-push-pr` | Commit, push, and open a PR with an adaptive description |

### Workflow Utilities

| Skill | Description |
|-------|-------------|
| `/changelog` | Create engaging changelogs for recent merges |
| `/onboarding` | Generate `ONBOARDING.md` to help new contributors understand the codebase |
| `/resolve-pr-feedback` | Resolve PR review feedback in parallel |
| `/ce-setup` | Diagnose environment, install missing tools, and bootstrap project config |
| `/todo-resolve` | Resolve todos in parallel |
| `/todo-triage` | Triage and prioritize pending todos |

### Beta / Experimental

| Skill | Description |
|-------|-------------|
| `/lfg` | Full autonomous engineering workflow |

## Agents

Agents are specialized subagents invoked by skills -- you typically don't call these directly.

### Review

| Agent | Description |
|-------|-------------|
| `correctness-reviewer` | Logic errors, edge cases, state bugs |
| `security-reviewer` | Exploitable vulnerabilities with confidence calibration |
| `performance-reviewer` | Runtime performance with confidence calibration |
| `maintainability-reviewer` | Coupling, complexity, naming, dead code |
| `testing-reviewer` | Test coverage gaps, weak assertions |
| `architecture-strategist` | Architectural decisions and compliance |
| `code-simplicity-reviewer` | Final pass for simplicity and minimalism |
| `adversarial-reviewer` | Construct failure scenarios across component boundaries |
| `project-standards-reviewer` | CLAUDE.md and AGENTS.md compliance |
| `reliability-reviewer` | Production reliability and failure modes |
| `data-migrations-reviewer` | Migration safety with confidence calibration |
| `api-contract-reviewer` | Detect breaking API contract changes |
| `performance-oracle` | Deep performance analysis and optimization |
| `security-sentinel` | Security audits and vulnerability assessments |
| `data-integrity-guardian` | Database migrations and data integrity |
| `pattern-recognition-specialist` | Analyze code for patterns and anti-patterns |
| `schema-drift-detector` | Detect unrelated schema changes in PRs |
| `deployment-verification-agent` | Go/No-Go deployment checklists |

### Document Review

| Agent | Description |
|-------|-------------|
| `coherence-reviewer` | Internal consistency, contradictions, terminology drift |
| `design-lens-reviewer` | Missing design decisions, interaction states |
| `feasibility-reviewer` | Technical feasibility assessment |
| `product-lens-reviewer` | Problem framing, scope decisions, goal alignment |
| `scope-guardian-reviewer` | Unjustified complexity, scope creep, premature abstractions |
| `security-lens-reviewer` | Security gaps at the plan level |
| `adversarial-document-reviewer` | Challenge premises, surface unstated assumptions |

### Research

| Agent | Description |
|-------|-------------|
| `learnings-researcher` | Search institutional learnings for relevant past solutions |
| `repo-research-analyst` | Research repository structure and conventions |
| `git-history-analyzer` | Analyze git history and code evolution |
| `best-practices-researcher` | Gather external best practices and examples |
| `session-historian` | Search prior sessions for related investigation context |
| `framework-docs-researcher` | Research framework documentation and best practices |
| `issue-intelligence-analyst` | Analyze GitHub issues to surface recurring themes |
| `slack-researcher` | Search Slack for organizational context |

### Design

| Agent | Description |
|-------|-------------|
| `design-implementation-reviewer` | Verify UI implementations match designs |
| `design-iterator` | Iteratively refine UI through design iterations |
| `figma-design-sync` | Synchronize implementations with Figma designs |

### Docs

| Agent | Description |
|-------|-------------|
| `ankane-readme-writer` | Create READMEs following Ankane-style template |

### Workflow

| Agent | Description |
|-------|-------------|
| `pr-comment-resolver` | Address PR comments and implement fixes |
| `spec-flow-analyzer` | Analyze user flows and identify gaps |

## Workflow

```
Brainstorm -> Plan -> Work -> Review -> Compound -> Repeat
    ^
  Ideate (optional)
```

Each cycle compounds: brainstorms sharpen plans, plans inform future plans, reviews catch more issues, patterns get documented.

## Installation

```bash
claude /plugin install compound-engineering
```

Then run `/ce-setup` to check your environment and install recommended tools.

## License

MIT
