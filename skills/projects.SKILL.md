---
name: projects
description: Manage projects and edit project code. Create, modify, or delete files in project GitHub repos using project_code_edit (Claude Code). Group linked services (GitHub, Vercel, Supabase, etc.) into named projects.
metadata: {"openclaw": {"emoji": "📁"}}
---

# Projects

Create and manage projects in the Omniclaw dashboard. A **project** groups linked services across platforms — GitHub repos, Vercel deployments, Supabase instances, etc.

## No Setup Required

Project tools work immediately — no authentication needed. They store data locally in SQLite.

## Available Tools

### CRUD
- `project_create` — Create a new project (name, description, color)
- `project_update` — Update a project's name, description, or color
- `project_delete` — Delete a project and all its links

### Links
- `project_add_link` — Link a platform service to a project
- `project_remove_link` — Remove a link from a project

### Code Editing
- `project_code_edit` — **Launch Claude Code** to make changes to a project's GitHub repo

## Code Editing Rules

**You are NOT allowed to write, edit, or modify code yourself.** You are strictly an orchestrator. You MUST NOT use `github_create_file`, `github_update_file`, or any GitHub API tool to create or modify files. You MUST NOT generate code content in tool parameters.

The ONLY way to make code changes to a project is via `project_code_edit`, which spawns a dedicated Claude Code (Opus 4.6) instance inside the project's cloned repository. Claude Code has full access to the codebase — it can read files, write files, run commands, and commit.

**When the user asks you to:**
- Write code, add features, fix bugs, refactor, add files, update configs, create READMEs, or do ANY development work on a project

**You MUST:**
1. Identify the project (by name or ID)
2. Call `project_code_edit` with `project_id` and clear natural-language `instructions`
3. Report the result (branch name, what was done)

**You MUST NOT:**
- Use ANY GitHub API tool to modify repositories — this includes `github_create_file`, `github_update_file`, `github_delete_file`, `github_create_pull_request`, `github_merge_pull_request`, or any other write operation
- Generate code, file content, or commit messages yourself and pass them through GitHub tools
- Use shell commands, scripts, or any other tool to modify project files
- Attempt to make ANY change to a project's repository through any means other than `project_code_edit`

**GitHub tools are READ-ONLY for you.** You may use `github_get_repo`, `github_repo_tree`, `github_get_file`, `github_issues`, `github_pulls`, etc. to gather information. But ALL modifications — creating files, deleting files, editing code, managing branches — go through `project_code_edit` exclusively.

`project_code_edit` will:
1. Clone the project's linked GitHub repo (or pull if already cloned)
2. Create a feature branch (`openclaw/<timestamp>-<slug>`)
3. Run Claude Code (Opus 4.6) with your instructions (autonomous, full permissions)
4. Commit and push the branch

## Orchestration Guide

You are a **project manager**, not a developer. Your job is to give Claude Code clear, detailed instructions so it can do the work autonomously. Think of yourself as a senior engineer writing a ticket for a junior dev — be specific.

### Writing Good Instructions

**Bad** (vague, Claude Code has to guess):
```
instructions: "fix the bug"
```

**Good** (specific, actionable, gives context):
```
instructions: "There's a bug in src/auth/login.ts where the JWT token expiry is checked with `>` instead of `<`, causing tokens to be rejected before they expire. Fix the comparison operator on the line with `tokenExpiry > Date.now()` — it should be `<`. Run the existing tests to make sure they pass."
```

**Best practices for instructions:**
- Describe WHAT to change and WHERE (file paths, function names, line numbers if you know them)
- Explain WHY — give context about the bug, feature, or goal
- Tell it what to name the commit
- If relevant, tell it to run tests or build before committing
- For large tasks, break them into steps within the instructions

### Gathering Context First

Before calling `project_code_edit`, use your other tools to understand the situation:

1. **Use `github_get_repo`** to understand the project (language, structure)
2. **Use `github_repo_tree`** to see the file structure
3. **Use `github_get_file`** to read specific files and understand current code
4. **Use `github_issues`** or `github_get_issue`** to understand reported bugs/feature requests
5. **Use `github_pulls`** to see what's already in progress

Then synthesize what you learned into clear instructions for `project_code_edit`.

### Setting Up Project Infrastructure

When a project is first created or needs Claude Code configuration, include setup instructions:

**CLAUDE.md** — Project memory file that Claude Code reads automatically:
```
instructions: "Create a CLAUDE.md file in the project root with the following content:
- Project name and description
- Tech stack (Next.js 15, TypeScript, Tailwind, etc.)
- Build command: pnpm build
- Test command: pnpm test
- Key architecture notes
- Any conventions (naming, file structure, etc.)
Then commit it."
```

**Skills** — Reusable instruction files for Claude Code at `.claude/skills/`:
```
instructions: "Create a skill file at .claude/skills/deploy.md that teaches Claude Code how to deploy this project:
1. Run pnpm build
2. Run pnpm test
3. If tests pass, push to main
Then commit."
```

### Multi-Step Workflows

For complex tasks, make multiple `project_code_edit` calls in sequence:

1. **Explore first**: Ask Claude Code to analyze the codebase and report back
   ```
   instructions: "Read the codebase and create a CLAUDE.md summarizing the architecture, tech stack, key files, build/test commands, and any patterns you notice. Commit it."
   ```

2. **Then implement**: Use what you learned to give targeted instructions
   ```
   instructions: "Add a dark mode toggle. The app uses Tailwind CSS with a ThemeProvider in src/providers/. Add a toggle button in the navbar component at src/components/navbar.tsx. Use the existing cn() utility for class merging. Run pnpm build to verify. Commit with message 'feat: add dark mode toggle'."
   ```

3. **Then verify**: Ask Claude Code to review or test
   ```
   instructions: "Run the full test suite with pnpm test. If any tests fail, fix them. Then run pnpm build to make sure everything compiles. Commit any fixes."
   ```

### Using Plugins

Claude Code has access to plugins that extend its capabilities. When writing instructions, you can tell it to use them:

**Ralph Loop** — For iterative tasks where Claude Code should keep working until a goal is met:
```
instructions: "Use the /ralph-loop command to iteratively improve the test coverage in src/utils/. Keep adding tests until all exported functions have at least one test. The completion promise is 'all exported functions have tests'."
```

**Brainstorming** — For open-ended design work:
```
instructions: "Use the /brainstorming skill to design an authentication system for this app. Consider OAuth, JWT, and session-based approaches. Write the design doc to docs/plans/."
```

**Code Review** — After making changes:
```
instructions: "Use the /code-review skill to review the changes on this branch compared to main. Fix any issues found."
```

### Iterating on Code Changes

`project_code_edit` supports multi-turn sessions on the same branch via the `branch` parameter:

1. **First call** (no `branch`): Creates a new branch, runs Claude Code, pushes
2. **Follow-up calls** (with `branch`): Checks out the same branch, runs Claude Code again, pushes

**Session persistence**: When `branch` is passed, Claude Code automatically resumes the previous session with full context retained — all files read, changes made, tool calls, and reasoning. No need to re-explain prior work; follow-up instructions like "fix that test" just work because Claude Code remembers what "that" refers to. If the session can't be resumed (e.g. corrupt session), it falls back to a fresh session transparently.

**When to iterate:**
- Claude Code's output mentions failing tests → send fix instructions on the same branch
- The user asks for changes to what was just built → continue on the same branch
- Complex features that need step-by-step implementation

**Example flow:**
1. `project_code_edit(id, "add user auth with JWT")` → returns branch: `openclaw/123-add-auth`
2. Read output — tests fail on token refresh
3. `project_code_edit(id, "fix the token refresh test — it needs to mock the expiry", branch: "openclaw/123-add-auth")`
   - Claude Code resumes with full context of the prior session — it already knows the codebase, the auth implementation, and which test failed
4. Output shows all tests pass → done, report branch to user

**Always report the branch name** so you can reference it in follow-up calls.

### Handling Results

After `project_code_edit` returns:
- **Report the branch name** to the user (e.g. `openclaw/1740600000-add-dark-mode`)
- **Summarize what Claude Code did** based on the output
- The result includes metadata: `session_id` (for session persistence), `num_turns` (API round-trips), `cost_usd` (total cost), `duration_ms` (wall-clock time)
- If the user wants a PR, use `github_create_pull_request` to create one from the branch
- If something failed, read the error, adjust your instructions, and try again with the `branch` parameter to continue on the same branch

## Platform Identifiers

When linking a service, use these platform values:

| Platform | `platform` value | `identifier` format |
|---|---|---|
| GitHub | `github` | `owner/repo` (e.g. `mxy680/omniclaw`) |
| Vercel | `vercel` | Project ID or name |
| Supabase | `supabase` | Project ref |
| Cloudflare | `cloudflare` | Zone or project ID |
| npm | `npm` | Package name |
| PyPI | `pypi` | Package name |
| Docker Hub | `docker-hub` | `user/image` |
| Hetzner | `hetzner` | Server or project ID |

## Workflow

### Creating a project with links

1. `project_create` with a name and optional description/color.
2. `project_add_link` for each service — pass the project ID from step 1.
3. For GitHub links, include `metadata` with repo details (language, stars, forks, openPRs) so the dashboard card shows rich info.

### Example: set up a project

```
project_create name="omniclaw" description="AI-powered personal dashboard" color="#3178c6"
```

Then link services:

```
project_add_link project_id="<id>" platform="github" identifier="mxy680/omniclaw" metadata={"language":"TypeScript","languageColor":"#3178c6","stars":0,"forks":0,"openPRs":2}
```

### Enriching GitHub links

When adding a GitHub link, fetch repo details with `github_get_repo` first, then pass the relevant fields as `metadata`:

- `language`, `languageColor` — primary language
- `stars`, `forks` — counts
- `openPRs` — from `github_pulls` with `state=open`
- `description` — repo description

This metadata is cached and displayed on the dashboard project card.

## Dashboard Behavior

- The dashboard auto-updates in real-time via WebSocket when projects are created, updated, or deleted.
- Project cards show a colored accent bar, platform icons for each link, and GitHub metadata inline.
- Clicking a card expands it to show per-link details.
- When no projects exist, the page shows an empty state prompting the user to ask the agent.
