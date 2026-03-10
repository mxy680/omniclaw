# Google Workspace, GitHub & Gemini MCP Server

This project is an MCP server providing tools for Gmail, Calendar, Drive, Docs, Sheets, Slides, YouTube, GitHub, and Gemini media generation.

## Integrations

| Service | Tools | Skill | Docs |
|---|---|---|---|
| Gmail | 20 | `gmail` | `docs/google-workspace.md` |
| Google Calendar | 11 | `calendar` | `docs/google-workspace.md` |
| Google Drive | 15 | `drive` | `docs/google-workspace.md` |
| Google Docs | 8 | `docs` | `docs/google-workspace.md` |
| Google Sheets | 11 | `sheets` | `docs/google-workspace.md` |
| Google Slides | 9 | `slides` | `docs/google-workspace.md` |
| YouTube | 10 | `youtube` | `docs/youtube.md` |
| GitHub | 95 | `github` | `docs/github.md` |
| Gemini | 4 | `gemini` | `skills/gemini.SKILL.md` |
| Wolfram Alpha | 2 | `wolfram` | `docs/wolfram.md` |
| LinkedIn | 11 | `linkedin` | `skills/linkedin.SKILL.md` |
| Instagram | 14 | `instagram` | `skills/instagram.SKILL.md` |
| Framer | 59 | `framer` | `skills/framer.SKILL.md` |

## Scheduler

Agents can run proactively via cron jobs defined in `~/.openclaw/schedules.json`. Each job points to a markdown instruction file in the agent's workspace (`~/.openclaw/agents/{agentId}/instructions/`). When a job fires, the scheduler connects to the Gateway via WebSocket, sends the instructions as a chat message, and persists the results to `~/.openclaw/agents/{agentId}/schedule-results/{jobId}/`.

Key files: `src/scheduler/` (types, stores, gateway-client, scheduler-service), REST API at `/api/schedules/*`.

Env vars: `OMNICLAW_GATEWAY_URL` (default `ws://localhost:18789`), `OMNICLAW_SCHEDULER_ENABLED` (default `true`).

## Testing

- `pnpm build` — TypeScript compilation
- `pnpm test` — unit tests
- `pnpm test:integration` — integration tests (requires real credentials)
- `OMNICLAW_MCP_TOKEN=dev pnpm mcp:dev` — start MCP server locally

**Important:** Each integration has a dedicated omniclaw test account. Tests must always use the `"default"` account — never a personal account. The `"default"` key in the token/session stores points to omniclaw test accounts. Do not override `GMAIL_ACCOUNT`, `YOUTUBE_ACCOUNT`, or similar env vars to use non-default accounts in tests. GitHub read tests use `octocat/Hello-World` (public repo); write tests require `RUN_WRITE_TESTS=1`.

## Multi-Account Architecture

All services support multiple named accounts. Tools accept an optional `account` parameter (defaults to `"default"`).

| Service | Token Store | Client Manager | Auth |
|---|---|---|---|
| Google Workspace | `~/.openclaw/omniclaw-tokens.json` | `OAuthClientManager` | OAuth2 |
| GitHub | `~/.openclaw/github-keys.json` | `GitHubClientManager` | PAT |
| Gemini | `~/.openclaw/gemini-keys.json` | `GeminiClientManager` | API key |
| Wolfram | `~/.openclaw/wolfram-keys.json` | `WolframClientManager` | App ID |
| LinkedIn | `~/.openclaw/linkedin-sessions.json` | `LinkedinSessionClient` | Session cookie |
| Instagram | `~/.openclaw/instagram-sessions.json` | `InstagramSessionClient` | Session cookie |
| Framer | `~/.openclaw/framer-keys.json` | `FramerClientManager` | API key (JSON: `{url, apiKey}`) |

Key classes: `ApiKeyStore` (generic string-value store for GitHub/Gemini/Wolfram/Framer), `TokenStore` (Google OAuth credentials), `SessionStore` (LinkedIn/Instagram sessions). Legacy single-token config keys (`github_token`, `gemini_api_key`, `wolfram_appid` in `mcp-server-config.json`) are auto-migrated to the "default" account in the new stores on first startup.

# currentDate
Today's date is 2026-03-08.
