# Vercel Integration Design

**Date**: 2026-02-27
**Status**: Approved

## Overview

Add a Vercel integration to omniclaw with 16 tools covering authentication, projects, deployments, domains, and environment variables. Uses Vercel REST API with Bearer token auth (single account).

## Auth

- API token auth (`Authorization: Bearer <token>`)
- Token created at https://vercel.com/account/tokens
- Single-account support (keyed as `"default"`)
- Token stored at `~/.openclaw/omniclaw-vercel-tokens.json`
- Config key `vercel_token` in `openclaw.plugin.json`

## API Details

- Base URL: `https://api.vercel.com`
- Team-scoped resources: append `?teamId=<id>` query param
- Pagination: cursor-based via `?until=<timestamp>` or `?next=<cursor>`
- Rate limits via `X-RateLimit-*` headers

## Tools (16)

### Auth (1)
| Tool | Description |
|------|-------------|
| `vercel_auth_setup` | Validate and store a Vercel API token |

### Projects (4)
| Tool | Description |
|------|-------------|
| `vercel_projects` | List all projects |
| `vercel_get_project` | Get project details by name or ID |
| `vercel_create_project` | Create a new project |
| `vercel_delete_project` | Delete a project |

### Deployments (5)
| Tool | Description |
|------|-------------|
| `vercel_deployments` | List deployments (filterable by project) |
| `vercel_get_deployment` | Get deployment details |
| `vercel_create_deployment` | Trigger a new deployment |
| `vercel_cancel_deployment` | Cancel a running deployment |
| `vercel_deployment_events` | Get deployment build logs/events |

### Domains (3)
| Tool | Description |
|------|-------------|
| `vercel_domains` | List all domains |
| `vercel_add_domain` | Add a domain to a project |
| `vercel_remove_domain` | Remove a domain |

### Environment Variables (3)
| Tool | Description |
|------|-------------|
| `vercel_env_vars` | List env vars for a project |
| `vercel_create_env_var` | Create or update an env var |
| `vercel_delete_env_var` | Delete an env var |

## Architecture

### Files
```
src/auth/vercel-client-manager.ts    # Token storage + HTTP client
src/tools/vercel-auth.ts             # Auth setup tool
src/tools/vercel-projects.ts         # Project CRUD tools
src/tools/vercel-deployments.ts      # Deployment tools
src/tools/vercel-domains.ts          # Domain tools
src/tools/vercel-env.ts              # Env var tools
src/types/plugin-config.ts           # Add vercel_token field
src/plugin.ts                        # Register tools
openclaw.plugin.json                 # Add config schema
skills/vercel.SKILL.md               # Skill file
docs/vercel.md                       # Docs
tests/integration/vercel.test.ts     # Integration tests
```

### Patterns
- `VercelClientManager`: same pattern as `GitHubClientManager` — token file I/O, HTTP methods, error handling
- Tool factory functions returning `{ name, label, description, parameters, execute }` objects
- Typebox parameter schemas with optional `team_id` on relevant tools
- `jsonResult()` for return values
- Registration in `plugin.ts` before the `client_secret_path` guard (no Google OAuth needed)
