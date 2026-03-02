# omniclaw

Google Workspace MCP server for [OpenClaw](https://openclaw.ai). Gives your AI agent full access to Gmail, Calendar, Drive, Docs, Sheets, Slides, and YouTube through natural language. Every integration supports downloading media and files to disk.

## What's Included

| Service | Tools | Skills | Docs |
|---------|-------|--------|------|
| Gmail | 10 tools — inbox, search, read, send (with attachments), reply, forward, download attachments, manage | `gmail` | [Setup & Reference](docs/google-workspace.md) |
| Google Calendar | 7 tools — list, view, create, update, delete, RSVP | `calendar` | [Setup & Reference](docs/google-workspace.md) |
| Google Drive | 10 tools — browse, search, read, upload (text & binary), download, organize, share, delete | `drive` | [Setup & Reference](docs/google-workspace.md) |
| Google Docs | 5 tools — create, read, append, find-and-replace, export (PDF/DOCX) | `docs` | [Setup & Reference](docs/google-workspace.md) |
| Google Sheets | 6 tools — create, read, write, append, clear, export (PDF/XLSX/CSV) | `sheets` | [Setup & Reference](docs/google-workspace.md) |
| Google Slides | 5 tools — create, read, add slides, find-and-replace, export (PDF/PPTX) | `slides` | [Setup & Reference](docs/google-workspace.md) |
| YouTube | 7 tools — search, video details, transcripts, channels, comments, download thumbnails | `youtube` | [Setup & Reference](docs/youtube.md) |

## Quick Start

### 1. Install omniclaw into OpenClaw

```bash
openclaw plugins install --link /path/to/omniclaw
```

Or if running from the OpenClaw monorepo as a built-in extension, place this repo under `extensions/omniclaw/` — the workspace auto-discovers it.

### 2. Set up Google Workspace

All services share a single OAuth2 setup. See [docs/google-workspace.md](docs/google-workspace.md) for detailed instructions.

### 3. Run as standalone MCP server

```bash
OMNICLAW_MCP_TOKEN=your-secret pnpm mcp:dev
```

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # TypeScript compilation
pnpm test             # Run unit tests
pnpm test:integration # Run integration tests (requires real credentials)
```

## Architecture

- **Auth managers** (`src/auth/`) — handle OAuth2, token storage, and multi-account authentication
- **Tool factories** (`src/tools/`) — each tool is a factory function returning `{ name, label, description, parameters, execute }`
- **Tool registry** (`src/mcp/tool-registry.ts`) — master registry that instantiates all tools
- **MCP server** (`src/mcp-server.ts`) — standalone MCP server entry point
- **Plugin registration** (`src/plugin.ts`) — the `register(api)` function for OpenClaw integration
- **Skills** (`skills/`) — SKILL.md files that teach the agent how to combine tools for each service
- **Multi-account** — every tool accepts an optional `account` parameter (defaults to `"default"`)

## License

MIT
