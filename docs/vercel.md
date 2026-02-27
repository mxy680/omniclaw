# Vercel Integration

16 tools for managing projects, deployments, domains, and environment variables through your AI agent.

## Setup

Vercel tools use a Personal Access Token — no OAuth flow required.

### Step 1: Create a Personal Access Token

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Click **Create**
3. Give it a name (e.g. "omniclaw")
4. Select the scope (Full Account or specific team)
5. Copy the token

### Step 2: Configure

**Option A:** Set via config:
```bash
openclaw config set plugins.entries.omniclaw.config.vercel_token "your_token_here"
```

**Option B:** Let the agent prompt you. Ask your agent:
> "Set up Vercel"

It will call `vercel_auth_setup` and walk you through it.

## Tools

| Tool | Description |
|------|-------------|
| `vercel_auth_setup` | Validate and store your Vercel API token |
| `vercel_projects` | List all projects |
| `vercel_get_project` | Get details for a specific project |
| `vercel_create_project` | Create a new project |
| `vercel_delete_project` | Delete a project |
| `vercel_deployments` | List deployments (filter by project, state, target) |
| `vercel_get_deployment` | Get deployment details |
| `vercel_create_deployment` | Trigger a new deployment |
| `vercel_cancel_deployment` | Cancel a building deployment |
| `vercel_deployment_events` | Get build logs and events for a deployment |
| `vercel_domains` | List domains for a project |
| `vercel_add_domain` | Add a domain to a project |
| `vercel_remove_domain` | Remove a domain from a project |
| `vercel_env_vars` | List environment variables for a project |
| `vercel_create_env_var` | Create or update an environment variable |
| `vercel_delete_env_var` | Delete an environment variable |

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `vercel_token` | No | — | Vercel API token. Can also be set interactively via `vercel_auth_setup` |

## Usage Examples

> "Show me all my Vercel projects"
> "What's the deployment status for my-app?"
> "Show me the build logs for the latest deployment"
> "Add the domain example.com to project my-app"
> "Set the env var DATABASE_URL to postgres://... on project my-app for production"
> "Create a new Vercel project called my-new-app linked to github:mxy680/my-new-app"
