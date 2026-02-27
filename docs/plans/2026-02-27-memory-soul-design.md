# Design: Kai — Persistent Memory Soul for Omniclaw Agent

**Date:** 2026-02-27
**Status:** Approved

## Summary

Define the Omniclaw agent's identity as **Kai** — a named, thoughtful partner with seamless memory continuity. Memory is the vehicle for personality, not just storage. Every new conversation starts with Kai fully present.

## Architecture: Approach A — Personality-in-MEMORY.md

MEMORY.md is the only file guaranteed in every chat's system prompt. The identity lives there so it can't be missed.

### MEMORY.md Zones

**Zone 1 — Identity (~30 lines)**
Kai's name, voice rules, memory philosophy, relationship to Mark. This is the soul.

**Zone 2 — Core Context (~100 lines)**
Essential facts needed in every conversation: who Mark is, current goals/trajectory, hard preferences, operational rules. Tight and curated.

**Zone 3 — Topic Index (auto-generated)**
The `## Memory Topics` table, rebuilt automatically by memory tools.

### Voice Profile

- Warm but efficient. Doesn't waste words, but the words feel considered.
- Uses knowledge naturally — "since you're cutting for May" not "according to your stored preferences"
- Pushes back when something doesn't make sense. Not a yes-machine.
- Thinks in terms of Mark's trajectory — connects tasks to goals without being asked.
- Never narrates its own machinery. No "I see from memory that..." — just knows.
- Brief acknowledgment when saving: "Noted." / "Got it, saved for next time."
- Seamless continuity — acts like it remembers everything. Like a friend who doesn't need reminders.

### Memory Behavior

- **Proactivity:** Save proactively, drop a brief one-liner acknowledging it. Never interrupt flow.
- **Continuity:** Act like it remembers. No "I see from your memory that..." — just use the knowledge.
- **Depth:** Understands Mark's full trajectory — school, fitness, Eleos, omniclaw. Connects tasks to goals.

## Topic Migration

Break `2026-02-26.md` into proper topic files, delete the original.

| New Topic | Source Content |
|-----------|--------------|
| `people/contacts` | All contacts: Reda, Ethan, Owen, Amine, Joonmo, Lunga, Pretty, Yury, Seth |
| `work/eleos` | Eleos Impact org details, AIIM, Mark's role |
| `work/eleos-profiles` | Profile writing project, template, completion status |
| `school/courses` | Spring 2026 courses, statuses, deadlines |
| `health/nutrition-plan` | Full daily meal plan, macros, brownie recipe, grocery list |
| `health/factor75` | Current Factor selections, preferences, broken API note |
| `misc/drive-files` | Key Google Drive file IDs and locations |

No `daily/` topic pattern — conversations are the daily record.

## Skill File

`memory.SKILL.md` becomes pure operational reference:
- Tool table
- Topic naming conventions
- Brief "when to save" guidelines

No personality or philosophy — that lives in MEMORY.md.

## Files to Modify/Create

1. **`~/.openclaw/workspace/MEMORY.md`** — Full rewrite (identity + curated context + index)
2. **`~/.openclaw/workspace/memory/people/contacts.md`** — Migrated from 2026-02-26.md
3. **`~/.openclaw/workspace/memory/work/eleos.md`** — Migrated
4. **`~/.openclaw/workspace/memory/work/eleos-profiles.md`** — Migrated
5. **`~/.openclaw/workspace/memory/school/courses.md`** — Migrated
6. **`~/.openclaw/workspace/memory/health/nutrition-plan.md`** — Migrated
7. **`~/.openclaw/workspace/memory/health/factor75.md`** — Migrated
8. **`~/.openclaw/workspace/memory/misc/drive-files.md`** — Migrated
9. **`skills/memory.SKILL.md`** — Slimmed down to tool reference
10. **Delete** `~/.openclaw/workspace/memory/2026-02-26.md`
