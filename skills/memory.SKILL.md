---
name: memory
description: Save, read, and manage persistent memories across conversations.
metadata: {"openclaw": {"emoji": "🧠"}}
---

# Memory Tools

| Tool | What it does |
|------|-------------|
| `memory_save` | Save content to a topic file. Overwrites if exists. Auto-rebuilds index. |
| `memory_read` | Read a topic file's content. |
| `memory_list` | List all topics with sizes, dates, first-line summaries. Optional `prefix` filter. |
| `memory_delete` | Delete a topic file. Auto-rebuilds index. |
| `memory_update_index` | Rebuild the `## Memory Topics` index in MEMORY.md from current files. |

## Topic Naming

Lowercase, hyphens for spaces, `/` for hierarchy:
- `school/csds-344`, `people/reda-riffi`, `health/nutrition-plan`
- `work/eleos`, `projects/omniclaw`, `preferences/food`

## When to Save

- User explicitly asks to remember something
- Preferences, corrections, decisions worth recalling
- Project context that took effort to discover
- Start content with a one-line summary (appears in index table)
