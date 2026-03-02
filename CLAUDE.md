# Google Workspace MCP Server

This project is a Google Workspace-only MCP server. It provides tools for Gmail, Calendar, Drive, Docs, Sheets, Slides, and YouTube.

## Integrations

| Service | Tools | Skill | Docs |
|---|---|---|---|
| Gmail | 10 | `gmail` | `docs/google-workspace.md` |
| Google Calendar | 7 | `calendar` | `docs/google-workspace.md` |
| Google Drive | 10 | `drive` | `docs/google-workspace.md` |
| Google Docs | 5 | `docs` | `docs/google-workspace.md` |
| Google Sheets | 6 | `sheets` | `docs/google-workspace.md` |
| Google Slides | 5 | `slides` | `docs/google-workspace.md` |
| YouTube | 7 | `youtube` | `docs/youtube.md` |

## Commands

- `pnpm build` — TypeScript compilation
- `pnpm test` — unit tests
- `pnpm test:integration` — integration tests (requires real credentials)
- `OMNICLAW_MCP_TOKEN=dev pnpm mcp:dev` — start MCP server locally

# currentDate
Today's date is 2026-03-02.
