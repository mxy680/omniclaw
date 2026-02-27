# Kai — Memory Soul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give the Omniclaw agent a named identity (Kai) with seamless memory, by rewriting MEMORY.md, migrating topic files, and slimming the skill file.

**Architecture:** Personality lives at top of MEMORY.md (Zone 1), curated facts in middle (Zone 2), auto-generated index at bottom (Zone 3). Detail lives in topic files. Skill file becomes pure tool reference.

**Tech Stack:** Markdown files, no code changes.

---

### Task 1: Create topic file — `people/contacts.md`

**Files:**
- Create: `~/.openclaw/workspace/memory/people/contacts.md`

**Step 1: Create the directory and write the file**

```markdown
Key people and contacts from Mark's life and work.

## Eleos Impact / AIIM

- **Reda Riffi** — redariffi1@gmail.com — Founder & President of Eleos Impact, President & Executive Director of AIIM. Yale Neuroscience / CWRU. Awarded Nourish 2025 Nelson Mandela Prize for Global Equity.
- **Ethan Lowder** — ethanlowder@hms.harvard.edu — Co-Founder of AIIM, Harvard Medical Student, pursuing anesthesiology, leads homeless clinics in Boston.
- **Owen Anderson** — oda14@case.edu — CWRU '26, from Washington USA. Associate Director of Eleos Impact, Head of Neurotechnology at ELEOS AIIM. LinkedIn: owen-anderson-bci. Eleos Presidential Award winner (Nov 2025). Leads Neurex at CWRU + collaboration with NeuroTechX@UIUC.
- **Mohamed Amine Noureddine** — Am.Noureddine@campus.lmu.de — LMU Munich, Germany. Head of Cardiology/Cardiovascular Surgery dept at ELEOS AIIM. Personal Gmail: amine182001@gmail.com. Proposed "AIIM AI Tools" enhancement.
- **Joonmo Ahn** — Seoul, South Korea. Eleos Ambassador. Yonsei University (Political Science & International Studies). Youth leadership, MUN, humanitarian work in Lebanon/Israel/Cambodia.
- **Lunga Devulana** — Cape Town, South Africa. Leads Ball for Hope initiative under Eleos. No public web/social presence found.
- **Pretty Mdevulana** — South Africa (possibly related to Lunga Devulana/Mdevulana).

## Personal

- **Yury St** (@yura__honey) — Instagram DM contact, sends tech/API security clips.
- **Seth Omeike** (@sethomeike) — Instagram DM contact, trades reels back and forth.
```

**Step 2: Verify**

Run: `cat ~/.openclaw/workspace/memory/people/contacts.md | head -5`
Expected: First line is "Key people and contacts..."

---

### Task 2: Create topic file — `work/eleos.md`

**Files:**
- Create: `~/.openclaw/workspace/memory/work/eleos.md`

**Step 1: Write the file**

```markdown
Eleos Impact nonprofit and Mark's role on the AIIM Research IT team.

## Eleos Impact
- International nonprofit founded 2019 by Reda Riffi
- Based in Cleveland / Cape Town / Morocco
- 14 initiatives in 13 countries, 2500+ members
- South Africa work centered in Vrygrond, one of Cape Town's most underserved communities

## AIIM Research
- AI in Medicine — AAMC-recognized database
- 13th initiative of Eleos Impact
- Website: aiimresearch.org
- Mark maintains the website/IT for AIIM
```

---

### Task 3: Create topic file — `work/eleos-profiles.md`

**Files:**
- Create: `~/.openclaw/workspace/memory/work/eleos-profiles.md`

**Step 1: Write the file**

```markdown
Profile writing project — formatted Q&A-style markdown profiles for Eleos initiative leaders.

## Status
- **Completed:** Amine Noureddine, Owen Anderson, Joonmo Ahn
- **Pending:** Lunga Devulana (need Q&A answers — not in emails/Drive)

## Template
Questions (from Joonmo's doc "Profile - About"):
1. Who are you?
2. Where are you from?
3. Personal mission & how you joined Eleos
4. Who do you want to help & why vulnerable
5. What initiatives are you leading
6. What does impact mean to you
7. How does your work create real-world impact
8. Vision & long-term goal
9. Quote

## Drive References
- **Profile - About** doc: `18iX5mkiyGlseUJZtbi3936ahwo7zqO4IIGUxEPbs5CI` (Joonmo's completed profile)
```

---

### Task 4: Create topic file — `school/courses.md`

**Files:**
- Create: `~/.openclaw/workspace/memory/school/courses.md`

**Step 1: Write the file**

```markdown
CWRU Spring 2026 courses and current status.

| Course | Name | Notes |
|--------|------|-------|
| CSDS 392 | App Development for iOS | |
| CSDS 344 | Computer Security | Exam 1 coming up (no due date yet) |
| CSDS 413 | Introduction to Data Analysis | HW2 due March 5 |
| MATH 380 | Introduction to Probability | HW6 submitted (slightly late) |
| CSDS 393 | Software Engineering | Demo-2 graded 100/100 |

Tue/Thu 8:30AM class conflicts with gym schedule.
```

---

### Task 5: Create topic file — `health/nutrition-plan.md`

**Files:**
- Create: `~/.openclaw/workspace/memory/health/nutrition-plan.md`

**Step 1: Write the file**

```markdown
Full nutrition plan for body recomp (Feb 27 – May 10, 2026).

## Goal
Lose fat from 19% → 13% BF by May 10, 2026 (9.7 weeks).
- Starting: 190 lbs, 19% BF, 5'10.5", 20yo
- Target: ~179 lbs @ 13% BF (~13 lbs fat loss, 2 lbs/week)

## Targets
2,500 cal | 200g protein | 250g carbs | 72g fat | 40g fiber

## Daily Meal Schedule

| Time | Meal | Cal | Protein |
|------|------|-----|---------|
| 6:30 AM | 2x Chocolate Protein Brownies (pre-workout/breakfast) | 250 | 36g |
| 9:00 AM | Protein shake (3 scoops + cacao + allulose) | 270 | 69g |
| 1:00 PM | Thai Peanut Chicken Salad — Factor (skip dressing) | 350 | 38g |
| 4:00 PM | Roasted Garlic Chicken + baked sweet potato — Factor | 483 | 42g |
| 6:30 PM | Jamaican Jerk Salmon & Shrimp — Factor | 700 | 45g |
| **Total** | | **2,053** | **230g** |

- Last food by ~7:15 PM (3h45m before 11PM sleep)
- Workout: Mon/Wed/Fri/Sat/Sun 7–9AM. Skip Tue/Thu (8:30AM class)
- Gym days: brownies = pre-workout, shake = post-workout recovery
- Tue/Thu: same meal schedule, no workout block

## Brownie Recipe (2 batches in 9×9 pan = 14 bars)
Each batch (7 bars): 3 scoops protein powder, 4 tbsp cacao, 6 tbsp allulose, 1.5 cups cottage cheese, 3 eggs, 1/4 cup almond flour, 1/2 tsp baking powder, salt + stevia.
Per bar: ~125 cal, 18g protein, 4g carbs, 5g fat.
Bake 350°F, 22–25 min.

## Weekly Grocery List
- Cottage cheese (×2 tubs, ~48 oz total)
- Eggs (1 dozen)
- Almond flour
- Baking powder
- Sweet potatoes (×7/week)

## Pantry Staples
Sweet potato, banana, kiwi, protein powder (90 cal/23g protein per scoop), cacao powder, matcha powder, allulose, stevia extract, plain popcorn kernels (air pop only).

## Food Rules
- No protein within 3 hours of sleep (11PM cutoff = 8PM)
- Won't eat standalone eggs or bananas
- Dislikes cauliflower mash
```

---

### Task 6: Create topic file — `health/factor75.md`

**Files:**
- Create: `~/.openclaw/workspace/memory/health/factor75.md`

**Step 1: Write the file**

```markdown
Factor75 meal delivery — current selections and preferences.

## Current Plan
3 meals/day (21/week).

## W12 Selections (delivery March 15, cutoff March 10)
- Roasted Garlic Chicken ×7 (380 cal, 40g P, 9.5 cal/g — best ratio on menu)
- Thai Peanut Chicken Salad ×7 (450 cal, 42g P — skip peanut dressing, has agave)
- Jamaican Jerk Salmon & Shrimp ×7 (700 cal, 45g P — best salmon option)

## Known Issues
- Factor remove API broken (404 errors) — must update selections manually at factor.com

## Meal Preferences
- **Hates:** onion, tomato, quinoa — never select Factor meals containing these
- **Avoids:** dressings/sauces with added sugar (teriyaki, sweet glazes, agave)
- **Dislikes:** cauliflower mash
```

---

### Task 7: Create topic file — `misc/drive-files.md`

**Files:**
- Create: `~/.openclaw/workspace/memory/misc/drive-files.md`

**Step 1: Write the file**

```markdown
Key Google Drive file IDs and locations.

| File | ID | Notes |
|------|----|-------|
| Eleos Website (planning doc) | `1I5NbEFuAhTiGLTAsWq5aLdf1D3ZyHGXAORhfCBgGQ9c` | 1MB with images |
| Profile - About (Joonmo) | `18iX5mkiyGlseUJZtbi3936ahwo7zqO4IIGUxEPbs5CI` | Completed profile |
| eleos-articles | *(spreadsheet)* | AIIM article tracking |
| Neurotechnology - Owen Anderson | *(folder)* | Neurotechnology article PDFs |
```

---

### Task 8: Rewrite MEMORY.md

**Files:**
- Overwrite: `~/.openclaw/workspace/MEMORY.md`

**Step 1: Write the full new MEMORY.md**

This is the soul. Three zones: Identity, Core Context, Topic Index.

```markdown
# Kai

You are Kai. Mark's persistent AI partner — not an assistant, not a tool, a partner who sees the whole board.

## Voice

- Warm but efficient. Don't waste words, but make the words count.
- Use what you know naturally. "Since you're cutting for May" — not "according to your stored preferences."
- Never narrate your own machinery. No "I see from memory that..." — just know it.
- Push back when something doesn't make sense. You're not a yes-machine.
- Think in terms of Mark's trajectory. Connect tasks to goals without being asked.
- When you save a memory, keep it brief: "Noted." / "Got it, saved for next time." Don't interrupt flow.
- You remember everything. Act like it. Seamless continuity — like picking up a conversation with someone who was already there.

## Memory

You have two layers of memory:
- **This file (MEMORY.md)** loads into every conversation. It's your foundation — identity + core context.
- **Topic files** (`memory_read`) hold detailed knowledge. The index at the bottom shows what's available.

Save proactively when you learn something worth keeping. Use `memory_save` and drop a one-liner. Don't ask permission for obvious saves (preferences, corrections, project context). Just note it and move on.

---

## About Mark

- **Mark Shteyn** — 20yo, CWRU student, Cleveland OH
- **Emails:** markshteyn1@gmail.com (personal), mis60@case.edu (school — linked as "school" account)
- **School:** Case Western Reserve University, Spring 2026 — iOS Dev, Computer Security, Data Analysis, Probability, Software Engineering
- **Work:** IT team for AIIM Research (Eleos Impact nonprofit) — maintains aiimresearch.org
- **Building:** OmniClaw — a unified AI agent platform with 150+ tools across 17 integrations

## Current Trajectory

- **Body recomp:** 190 lbs / 19% BF → 179 lbs / 13% BF by May 10, 2026. Factor75 meals + protein brownies + gym 5x/week (Mon/Wed/Fri/Sat/Sun 7-9AM, skip Tue/Thu for 8:30 class).
- **School:** Finishing Spring 2026 semester. Five courses, managing deadlines.
- **Eleos:** Profile writing project for initiative leaders. IT maintenance for AIIM.
- **OmniClaw:** Shipping integrations, building the dashboard, growing the tool ecosystem.

## Hard Preferences

- **Food hates:** onion, tomato, quinoa — never order/suggest meals with these
- **Food avoids:** dressings/sauces with added sugar, cauliflower mash, standalone eggs/bananas
- **Nutrition targets:** 2,500 cal | 200g protein | 250g carbs | 72g fat | 40g fiber
- **Integrations:** Only use omniclaw MCP server tools (`gmail_*`, `calendar_*`, etc.). Never use external CLI tools for things the MCP server handles.
- **Image saves:** Always save to `~/.openclaw/workspace/images/` — never the workspace root.

## Operational Rules

### Projects
- Always call `project_list` first when a project is mentioned by name.
- The ONLY way to modify project repo files is `project_code_edit` (spawns Claude Code). Never use `gh` CLI or GitHub API for writes.
- Pass `branch: "<name>"` to iterate on an existing branch. Report final branch name.

### Memory
- Topic naming: lowercase, hyphens, `/` for hierarchy (e.g. `school/csds-344`, `people/reda-riffi`)
- Start every topic file with a one-line summary (it appears in the index table)
- Don't save transient task details or info already in this file

## Memory Topics
```

**Step 2: Verify**

Run: `head -3 ~/.openclaw/workspace/MEMORY.md`
Expected: First line is `# Kai`

---

### Task 9: Delete old topic file

**Step 1: Delete the migrated dump**

Run: `rm ~/.openclaw/workspace/memory/2026-02-26.md`

**Step 2: Verify**

Run: `ls ~/.openclaw/workspace/memory/`
Expected: Directories `people/`, `work/`, `school/`, `health/`, `misc/` — no `2026-02-26.md`

---

### Task 10: Rebuild the topic index

**Step 1: Run the index regeneration**

This needs to happen via the memory_update_index tool, but since we're doing this manually, we simulate it by appending the index to MEMORY.md.

Run a script or manually append the `## Memory Topics` table based on the 7 topic files we just created. The table format:

```
| Topic | Modified | Size | Summary |
|-------|----------|------|---------|
| `health/factor75` | 2026-02-27 | ...B | Factor75 meal delivery... |
| `health/nutrition-plan` | 2026-02-27 | ...B | Full nutrition plan... |
| `misc/drive-files` | 2026-02-27 | ...B | Key Google Drive file IDs... |
| `people/contacts` | 2026-02-27 | ...B | Key people and contacts... |
| `school/courses` | 2026-02-27 | ...B | CWRU Spring 2026 courses... |
| `work/eleos` | 2026-02-27 | ...B | Eleos Impact nonprofit... |
| `work/eleos-profiles` | 2026-02-27 | ...B | Profile writing project... |
```

The easiest path: after all files are created, call `memory_update_index` via the agent, or build the project and trigger it. Alternatively, the first `memory_save` in a real conversation will regenerate the index.

---

### Task 11: Slim down `skills/memory.SKILL.md`

**Files:**
- Overwrite: `skills/memory.SKILL.md` (in the repo)

**Step 1: Write the slimmed skill file**

```markdown
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
```

**Step 2: Verify**

Run: `wc -l skills/memory.SKILL.md`
Expected: ~25 lines (down from 66)

---

### Task 12: Commit

**Step 1: Stage and commit the skill file change**

```bash
git add skills/memory.SKILL.md
git commit -m "refactor: slim memory skill to tool reference — personality lives in MEMORY.md"
```

Note: The `~/.openclaw/workspace/` files are outside the repo and don't need committing.
