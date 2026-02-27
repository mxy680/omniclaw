---
name: vercel
description: Vercel integration — manage projects, deployments, domains, and environment variables.
metadata: {"openclaw": {"emoji": "▲"}}
---

# Vercel

Manage Vercel projects, deployments, domains, and environment variables using natural language.

## First-Time Setup

Vercel uses a Personal Access Token — no OAuth flow needed.

1. Create a token at https://vercel.com/account/tokens
   - Select the appropriate scope (full account or specific team).
2. Save your token in the plugin config:

```bash
openclaw config set plugins.entries.omniclaw.config.vercel_token "your_token_here"
```

3. Call `vercel_auth_setup` with no arguments to validate:

```
vercel_auth_setup
```

The tool reads the token from config, verifies it against the Vercel API, and stores it for subsequent tool calls.

## Available Tools

### Auth
- `vercel_auth_setup` — Validate and store a Vercel API token (run once)

### Projects
- `vercel_projects` — List all projects
- `vercel_get_project` — Get project details by name or ID
- `vercel_create_project` — Create a new project (optionally linked to a git repo)
- `vercel_delete_project` — Delete a project (irreversible)

### Deployments
- `vercel_deployments` — List deployments (filter by project, state, target)
- `vercel_get_deployment` — Get deployment details
- `vercel_create_deployment` — Trigger a new deployment
- `vercel_cancel_deployment` — Cancel a building deployment
- `vercel_deployment_events` — Get build logs and events

### Domains
- `vercel_domains` — List domains for a project
- `vercel_add_domain` — Add a domain to a project
- `vercel_remove_domain` — Remove a domain from a project

### Environment Variables
- `vercel_env_vars` — List env vars for a project
- `vercel_create_env_var` — Create or update an env var (supports upsert)
- `vercel_delete_env_var` — Delete an env var

## Team Access

All tools accept an optional `team_id` parameter. Omit it for personal account access, or provide your Team ID for team-scoped operations.

## Workflow

1. Call `vercel_auth_setup` with no arguments — the tool reads the token from config automatically.
2. Use `vercel_projects` to see your projects.
3. Use `vercel_deployments` with a `project_id` to check deployment status.
4. Use `vercel_deployment_events` to view build logs for a specific deployment.
5. Use `vercel_env_vars` to check environment variables for a project.
6. Use `vercel_domains` to see which domains are connected.

## Error Handling

If any tool returns `"error": "auth_required"`, call `vercel_auth_setup` first.

If a token is invalid or expired, generate a new one at https://vercel.com/account/tokens and call `vercel_auth_setup` again.
