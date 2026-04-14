# Plugin Instructions

These instructions apply when working under `plugins/compound-engineering/`.

## Directory Structure

```
agents/
├── review/           # Code review agents
├── document-review/  # Plan and requirements document review agents
├── research/         # Research and analysis agents
├── design/           # Design and UI agents
├── docs/             # Documentation agents
└── workflow/         # Workflow agents

skills/
├── ce-*/          # Core workflow skills (ce:plan, ce:review, etc.)
└── */             # All other skills
```

## Skill Format

Skills are defined in `SKILL.md` files with YAML frontmatter:
- `name`: Skill identifier (lowercase-with-hyphens)
- `description`: What it does and when to use it

## Agent Format

Agents are defined as `.md` files with YAML frontmatter:
- `name`: Agent identifier
- `description`: What the agent does
- `temperature`: Model temperature (optional)

## Command Naming Convention

**Workflow commands** use `ce:` prefix to identify them as compound-engineering commands:
- `/ce:brainstorm` - Explore requirements and approaches before planning
- `/ce:plan` - Create implementation plans
- `/ce:review` - Run comprehensive code reviews
- `/ce:work` - Execute work items systematically
- `/ce:compound` - Document solved problems

**Why `ce:`?** The namespace makes it clear these commands belong to this plugin and avoids conflicts with built-in commands.

## Adding Components

- **New skill:** Create `skills/<name>/SKILL.md` with required YAML frontmatter. Add to README.md.
- **New agent:** Create `agents/<category>/<name>.md` with frontmatter. Categories: `review`, `document-review`, `research`, `design`, `docs`, `workflow`. Add to README.md.
