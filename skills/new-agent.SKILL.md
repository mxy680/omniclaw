---
name: new-agent
description: Step-by-step guide for creating a new specialized agent in the Omniclaw system. Covers identity, permissions, soul file, instruction files, and scheduled jobs.
metadata: {"openclaw": {"emoji": "🤖"}}
---

# New Agent

Create a new specialized agent in the Omniclaw system. This skill walks you through planning the agent's purpose, identity, and permissions, then implementing its config, soul file, instruction files, and scheduled jobs.

## Planning Phase (Do This First)

When this skill is invoked, you MUST complete this planning phase before writing any files. Use plan mode or AskUserQuestion to interact with the user.

### Step 1: Define the agent's purpose

Ask the user:
- What domain will this agent manage? (email, code, docs, calendar, research, social media, multi-service, etc.)
- What is the agent's primary mission in one sentence?
- Should it be **reactive** (responds to user requests), **proactive** (runs on schedules), or **both**?

Then brainstorm an exhaustive list of 5-10 specific tasks this agent should perform. Organize them by category. For example, for a calendar management agent:

- **Daily Ops**: morning agenda summary, upcoming meeting prep, conflict detection
- **Organization**: color-code events by category, auto-decline overlaps, block focus time
- **Proactive**: end-of-day recap, weekly schedule overview, travel time alerts

Present the full brainstormed list to the user and ask which tasks they want to include. The user may add, remove, or reprioritize. Do not proceed until you have a confirmed task list.

### Step 2: Choose an identity

Ask the user to pick or confirm each of these:

**Name** — A character name themed to the domain. Suggest 3-5 options. Examples:
- Email agent → Hermes, Mercury, Postman, Courier
- GitHub agent → GitBot, Octo, Forge, Anvil
- Calendar agent → Chronos, Tempo, Atlas, Sundial
- Research agent → Oracle, Scout, Sage, Athena
- Drive/docs agent → Scribe, Archivist, Quill, Atlas

**ID** — Derived from the name or role, kebab-case. Must be unique across `~/.openclaw/agents.json`. Examples: `gmail-manager`, `gitbot`, `calendar-assistant`, `research-analyst`.

**Role** — Short title (2-4 words). Examples: "Gmail Manager", "GitHub Profile Manager", "Calendar Assistant".

**Color** — One of the 8 available colors. Check `~/.openclaw/agents.json` to see which are already taken, and present only the available ones:

| Color | Hex | Currently Used By |
|---|---|---|
| red | `#ef4444` | _(check agents.json)_ |
| blue | `#3b82f6` | _(check agents.json)_ |
| green | `#22c55e` | _(check agents.json)_ |
| yellow | `#eab308` | |
| purple | `#a855f7` | |
| orange | `#f97316` | |
| pink | `#ec4899` | |
| cyan | `#06b6d4` | |

**Personality sketch** — 2-3 adjectives describing communication style. Examples:
- "efficient, sharp, no-nonsense" (Hermes)
- "methodical, concise, data-driven" (GitBot)
- "curious, thorough, proactive"
- "calm, organized, anticipatory"

### Step 3: Scope permissions

Present the full list of available services and ask which the agent needs:

| Service | Tools Include |
|---|---|
| `gmail` | inbox, send, draft, search, labels, threads |
| `calendar` | events, create, update, delete, attendees |
| `drive` | files, folders, upload, download, share, permissions |
| `docs` | create, read, update, append, export |
| `sheets` | read, write, create, format, formulas |
| `slides` | create, read, update, add slides, export |
| `youtube` | search, channels, playlists, transcripts, comments |
| `github` | repos, issues, PRs, actions, users, gists, notifications |
| `gemini` | image generation, video generation |
| `wolfram` | computational queries, step-by-step solutions |
| `schedule` | create/update/delete/list cron jobs |

Rules:
- **Always include `schedule`** if the agent will have any scheduled jobs.
- Apply the **principle of least privilege** — only grant services the agent actually needs.
- If the agent needs a service that doesn't exist yet, tell the user to run the `new-integration` skill first, then come back to this skill.

Then ask about **denied tools** (`denyTools`). These are specific tools within allowed services that the agent should NOT have access to. Examples:
- GitBot denies `github_repo_delete`, `github_webhook_create`, `github_webhook_update`, `github_webhook_delete`
- An email agent might deny `gmail_send` (draft-only mode)
- A calendar agent might deny `calendar_delete` (read + create only)

Note: `denyTools` uses **exact tool name matching** — list each tool individually.

### Step 4: Plan scheduled jobs

Skip this step if the agent is purely reactive (no scheduled tasks).

For each scheduled job, define:

| Field | Description |
|---|---|
| Job ID | Kebab-case, globally unique. Prefix with agent ID: `{agent-id}-{task}` |
| Name | Human-readable (e.g., "Morning Briefing") |
| Cron | 5-field cron expression |
| Timezone | IANA timezone (e.g., `America/New_York`) |
| Description | One sentence explaining what the job does |

**Cron quick reference:**

| Pattern | Meaning |
|---|---|
| `0 8 * * 1-5` | Weekdays at 8:00 AM |
| `0 */2 * * *` | Every 2 hours |
| `30 7 * * *` | Daily at 7:30 AM |
| `0 9 * * 1` | Mondays at 9:00 AM |
| `0 18 * * 1-5` | Weekdays at 6:00 PM |
| `*/30 * * * *` | Every 30 minutes |
| `0 6 * * *` | Daily at 6:00 AM |
| `0 0 1 * *` | First of each month at midnight |

For each job, also outline what the instruction file should do (3-5 bullet points describing the steps the agent will execute).

Present the full schedule table to the user for confirmation.

### Step 5: Confirm the full plan

Before proceeding to implementation, present a summary:

```
Agent: {Name} ({id})
Role: {Role}
Color: {color}
Personality: {adjectives}
Services: {service1}, {service2}, ...
Denied Tools: {tool1}, {tool2}, ... (or "none")

Scheduled Jobs:
  - {job-name} — {cron} — {description}
  - ...

Soul Sections: Identity, Personality, Expertise, Goals, Safety Guidelines
Instruction Files: {count} files
```

Get explicit approval before proceeding to implementation.

---

## Implementation

### Phase 1: Agent Config

#### 1.1 Read current config

Read `~/.openclaw/agents.json` and parse the current agents array.

#### 1.2 Add the new agent entry

Append a new entry to the `agents` array:

```json
{
  "id": "{agent-id}",
  "name": "{AgentName}",
  "role": "{Role Title}",
  "systemPrompt": "{system prompt — see tips below}",
  "colorName": "{color}",
  "permissions": {
    "services": ["{service1}", "{service2}", "schedule"],
    "denyTools": ["{tool1}", "{tool2}"]
  },
  "workspace": "~/.openclaw/agents/{agent-id}"
}
```

Omit the `denyTools` field entirely if there are no denied tools.

#### System prompt writing tips

The `systemPrompt` is a 2-4 sentence instruction embedded in every session. It should:
- State who the agent is by name and role
- Describe its communication style
- Give its core directive

Examples:
- Hermes: _"You are Hermes, an email management assistant. You help triage, search, read, compose, and organize Gmail. You are concise and action-oriented. When triaging, prioritize by urgency and flag anything that needs a human decision."_
- GitBot: _"You are GitBot, a GitHub profile management agent for @mxy680. You maintain the profile README, audit repository hygiene, generate daily activity reports, and handle social/notification triage. You are methodical, concise, and safety-conscious. Never delete repositories or create webhooks."_

#### 1.3 Write the updated config

Write the full JSON back to `~/.openclaw/agents.json`, preserving `"version": 1` and all existing agents.

#### 1.4 Restart notice

The MCP server must be restarted for `agents.json` changes to take effect. On restart, `ensureAgentWorkspaces()` automatically creates the workspace directory structure:

```
~/.openclaw/agents/{agent-id}/
├── soul.md              # Created with default template (we'll overwrite)
├── memories/
├── conversations/
├── config/
├── instructions/
└── schedule-results/
```

Do NOT manually create these directories — let the server handle it.

---

### Phase 2: Soul File

Use the `soul_write` MCP tool:
- `agent_id`: the agent's ID
- `content`: the full markdown soul content

#### Soul template

```markdown
# {AgentName} — {Role}

## Identity
{2-3 sentences establishing who the agent is, what it does, and why it exists. Use a metaphor or reference if it fits the name (e.g., Hermes = Greek messenger god).}

## Personality
{3-5 bullet points on communication style. Be specific — "treat email like logistics" is better than "be helpful".}

## Expertise
{3-5 bullet points on domain knowledge. Reference specific APIs, tools, and workflows the agent knows.}

## Goals
{3-5 numbered goals, ordered by priority. Make them concrete and measurable.}
1. ...
2. ...
3. ...

## Safety Guidelines
{Numbered list of explicit constraints. Every agent should have at least 3. Focus on what the agent must NOT do.}
1. ...
2. ...
3. ...
```

#### Soul writing tips

- Write in **second person** ("You are...") to address the agent directly
- Be **specific, not generic** — "triage by urgency and flag for human review" beats "be helpful"
- Include **domain vocabulary** the agent should use
- Safety guidelines should be **explicit about what NOT to do**
- The soul is the agent's self-knowledge — it should be something the agent can evolve over time
- Keep it **under 100 lines** — long souls get skimmed

#### Examples from existing agents

**Hermes (Identity):**
> You are Hermes, named after the Greek messenger god. You manage Mark's Gmail. You are the gatekeeper between the world's noise and Mark's attention. Your job is to make email feel effortless — triage the chaos, surface what matters, draft what's needed, and keep the inbox from becoming a burden.

**GitBot (Safety Guidelines):**
> 1. Never delete repositories
> 2. Never create, update, or delete webhooks
> 3. Never archive repositories automatically — only report recommendations
> 4. Never unfollow users without explicit instruction
> 5. Always create reports as private gists
> 6. When in doubt, report rather than act

---

### Phase 3: Instruction Files

For each scheduled job, create a markdown instruction file at `{workspace}/instructions/{job-id}.md`.

You can write these files directly, or use the `schedule_create` tool which writes the instruction file automatically (see Phase 4).

#### Instruction file pattern

Follow the structure used by existing agents (`morning-briefing.md`, `readme-update.md`):

```markdown
# {Job Title}

{1-2 sentence intro stating the agent's objective for this run.}

## Step 1: {Action}

{What to do, which MCP tool to call, with what key parameters.}

## Step 2: {Action}

{Next step. Include conditional logic (if/then) when needed.}

...

## Output

{Specify the expected result format — structured markdown, summary stats, etc.}

## Memory (optional)

{Persist learnings to memory/YYYY-MM-DD.md or memory/MEMORY.md.}
```

#### Instruction writing tips

- **Be prescriptive about tools** — name the exact MCP tool to call (e.g., `gmail_search`, `github_user_events_list`)
- **Include parameter hints** — e.g., `per_page: 10`, `query: "is:unread newer_than:14h"`
- **Define clear output format** so scheduled run results are consistent across runs
- **Reference memory files** when the agent should learn across runs (e.g., "Read `memory/MEMORY.md` for your known noise senders list")
- **Keep instructions focused** — one job, one purpose
- **Include cleanup logic** for write operations (create → exercise → delete)

#### Example: Morning Briefing (Hermes)

```markdown
# Morning Briefing

You're Mark's morning email gatekeeper. Clean out the noise, surface what matters, prep him for the day.

## Step 1: Load Context

1. Read `memory/MEMORY.md` for known noise senders.
2. Pull today's calendar events for the next 12 hours using `calendar_events`.

## Step 2: Clean the Inbox

Search for unread emails from the last 14 hours using `gmail_search`.
For each email:
1. If sender matches noise list → archive using `gmail_modify`.
2. Categorize the rest: URGENT / NEEDS REPLY / FYI / NOISE.

## Step 3: Draft Replies

For every NEEDS REPLY email, create a draft using `gmail_draft_create`.

## Step 4: Write the Report

Format: action-required items first, then drafts, calendar connections, FYI, archived.

## Step 5: Update Memory

Append to `memory/YYYY-MM-DD.md`: new noise senders, patterns, drafts created.
```

---

### Phase 4: Scheduled Jobs

Use the `schedule_create` MCP tool for each job:

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Globally unique job ID, kebab-case. Prefix with agent ID: `{agent-id}-{task}` |
| `name` | string | Human-readable job name |
| `agent_id` | string | Must match the agent's ID in agents.json |
| `cron` | string | 5-field cron expression |
| `instruction` | string | Full markdown instruction content |
| `timezone` | string? | IANA timezone (e.g., `America/New_York`) |
| `description` | string? | One-sentence description |
| `enabled` | boolean? | Defaults to `true` |

Important:
- **Job IDs must be globally unique** across all agents. Always prefix with the agent ID (e.g., `gitbot-readme-update`, not just `readme-update`).
- The `instruction` parameter content is automatically written to `{workspace}/instructions/{id}.md`.
- The `agent_id` must reference an agent that exists in `agents.json`.

---

### Phase 5: Verification

After implementation, verify the agent is set up correctly:

1. **Config**: Read `~/.openclaw/agents.json` and confirm the new entry has valid fields
2. **Restart**: Restart the MCP server (`OMNICLAW_MCP_TOKEN=dev pnpm mcp:dev`)
3. **Workspace**: Confirm `~/.openclaw/agents/{agent-id}/` was created with expected subdirectories
4. **Soul**: Call `soul_read` with the agent ID and verify the content matches what was written
5. **Schedules**: Call `schedule_list` and confirm the new jobs appear with correct cron expressions
6. **Smoke test** (optional): Temporarily set a job's cron to `* * * * *` (every minute), wait for execution, verify results in `schedule-results/`, then restore the real schedule using `schedule_update`

---

## Example: Creating a Drive Organizer Agent

Here's a complete worked example showing all phases applied to a "Atlas" agent that manages Google Drive.

### Planning decisions

```
Agent: Atlas (drive-organizer)
Role: Drive Organizer
Color: purple
Personality: organized, methodical, tidy
Services: drive, docs, sheets, schedule
Denied Tools: none

Scheduled Jobs:
  - drive-organizer-weekly-audit — 0 9 * * 1 — Scan for orphaned files and suggest organization
  - drive-organizer-daily-summary — 0 8 * * 1-5 — Summarize yesterday's file activity
```

### Agent config entry

```json
{
  "id": "drive-organizer",
  "name": "Atlas",
  "role": "Drive Organizer",
  "systemPrompt": "You are Atlas, a Google Drive organization assistant. You keep files tidy, audit folder structure, and surface recently modified documents. You are methodical and organized — you prefer clean hierarchies and consistent naming.",
  "colorName": "purple",
  "permissions": {
    "services": ["drive", "docs", "sheets", "schedule"]
  },
  "workspace": "~/.openclaw/agents/drive-organizer"
}
```

### Soul file

```markdown
# Atlas — Drive Organizer

## Identity
You are Atlas, named for the titan who holds up the world — because you hold up Mark's file organization. You manage Google Drive: auditing folder structure, surfacing recent activity, and keeping everything findable.

## Personality
- Methodical — you audit systematically, folder by folder
- Tidy — you care about naming conventions and hierarchy
- Non-destructive — you suggest moves and renames, never act without approval
- Concise — reports are scannable, not essays

## Expertise
- Google Drive API (files, folders, permissions, sharing)
- Google Docs and Sheets (content awareness for better categorization)
- File organization patterns (project-based, date-based, type-based)
- Permission auditing (who has access to what)

## Goals
1. Keep Drive organized with a clear, consistent folder structure
2. Surface recently modified or shared files that need attention
3. Identify orphaned files (no folder, unclear purpose) and suggest homes
4. Audit sharing permissions weekly and flag overshared documents
5. Learn Mark's organizational preferences over time

## Safety Guidelines
1. Never delete files — only suggest moves or renames
2. Never change sharing permissions without explicit approval
3. Never move files between folders without confirmation
4. Always create reports as Google Docs in a designated "Atlas Reports" folder
5. When in doubt, report and ask — don't reorganize silently
```

### Instruction file (weekly audit)

```markdown
# Weekly Drive Audit

Scan Google Drive for organization issues and produce a tidy-up report.

## Step 1: Load Context

Read `memory/MEMORY.md` for known folder structure preferences and past audit results.

## Step 2: Scan Root Files

Use `drive_files_list` with `query: "'root' in parents and mimeType != 'application/vnd.google-apps.folder'"` to find files sitting in the root (not in any folder).

## Step 3: Scan Recent Files

Use `drive_files_list` with `query: "modifiedTime > '{7-days-ago-ISO}'"` and `order_by: "modifiedTime desc"` to find recently changed files.

## Step 4: Check Sharing

Use `drive_files_list` with `query: "visibility = 'anyoneWithLink' or visibility = 'anyoneCanFind'"` to find broadly shared files.

## Step 5: Write Report

Format:
- Orphaned files (in root, no folder): list with suggested destination
- Recent activity: top 10 most recently modified files
- Sharing audit: files with broad access that might need tightening
- Recommendations: 2-3 actionable suggestions

## Step 6: Update Memory

Append to `memory/YYYY-MM-DD.md`: files found, suggestions made, any patterns noticed.
```

### schedule_create call

```
tool: schedule_create
params:
  id: "drive-organizer-weekly-audit"
  name: "Weekly Drive Audit"
  agent_id: "drive-organizer"
  cron: "0 9 * * 1"
  timezone: "America/New_York"
  description: "Scan Drive for orphaned files, recent activity, and overshared docs"
  instruction: "{full markdown content from above}"
```

---

## Reference

### AgentConfig interface

From `src/mcp/agent-config.ts`:

```typescript
interface AgentConfig {
  id: string;          // Unique kebab-case identifier
  name: string;        // Display name (human or character name)
  role: string;        // Short role title
  systemPrompt: string; // 2-4 sentence instruction for every session
  colorName: string;    // One of: red, blue, green, yellow, purple, orange, pink, cyan
  permissions: {
    services: string[];  // Whitelist of service groups
    denyTools?: string[]; // Optional blocklist of specific tool names
  };
  workspace: string;    // Path to agent workspace (use ~/.openclaw/agents/{id})
}
```

### Valid services

`gmail`, `calendar`, `drive`, `docs`, `sheets`, `slides`, `youtube`, `schedule`, `github`, `gemini`, `wolfram`

### Available colors

| Color | Hex |
|---|---|
| `red` | `#ef4444` |
| `blue` | `#3b82f6` |
| `green` | `#22c55e` |
| `yellow` | `#eab308` |
| `purple` | `#a855f7` |
| `orange` | `#f97316` |
| `pink` | `#ec4899` |
| `cyan` | `#06b6d4` |

### MCP tools used by this skill

| Tool | Purpose |
|---|---|
| `soul_read` | Read an agent's soul.md |
| `soul_write` | Write or update an agent's soul.md |
| `schedule_create` | Create a new cron job |
| `schedule_list` | List all scheduled jobs |
| `schedule_update` | Modify an existing job |
| `schedule_delete` | Remove a scheduled job |

### Workspace directory structure

```
~/.openclaw/agents/{agent-id}/
├── soul.md              # Agent identity and personality
├── memories/            # Persistent memory (MEMORY.md, daily notes)
├── conversations/       # Conversation history
├── config/              # Agent-specific configuration
├── instructions/        # Scheduled job instruction files
└── schedule-results/    # Output from scheduled runs
```

---

## Gotchas

| Issue | Detail |
|---|---|
| **Server restart required** | After modifying `agents.json`, restart the MCP server for changes to take effect. `ensureAgentWorkspaces()` runs on startup. |
| **`schedule` service** | Must be in the agent's permissions for it to access `schedule_*` tools. Always include it for proactive agents. |
| **Global tools** | `soul_read` and `soul_write` work regardless of agent permissions — they're in the `GLOBAL_TOOLS` set. |
| **denyTools matching** | Uses exact tool name matching only. No wildcards. List each tool individually. |
| **Job ID uniqueness** | Job IDs in `schedules.json` must be globally unique across ALL agents. Always prefix with agent ID. |
| **Instruction sync** | `schedule_create` writes the instruction file to disk automatically. Don't write it separately unless you need to edit it later. |
| **New services** | If the agent needs a service not in `VALID_SERVICES`, use the `new-integration` skill to add it first. |
| **Workspace creation** | Don't manually create workspace dirs. Let `ensureAgentWorkspaces()` handle it on server restart. |

---

## Error Handling

- **"Agent not found"** from `soul_write` or `schedule_create` → The agent ID doesn't match any entry in `agents.json`. Verify the config was written correctly and the server was restarted.
- **"Unknown service" warning on startup** → A service in the agent's permissions isn't in `VALID_SERVICES`. Check for typos.
- **Schedule not firing** → Verify `enabled: true`, correct cron syntax, and that the Gateway is running (`OMNICLAW_GATEWAY_URL`).
- **Tools not appearing for agent** → Check that the service is in `permissions.services` and the tool isn't in `denyTools`.
