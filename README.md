# omniclaw

120+ tools for [OpenClaw](https://openclaw.ai) that give your AI agent full access to Google Workspace, GitHub, Gemini AI, YouTube, Canvas LMS, LinkedIn, and Instagram. Manage emails, calendars, files, documents, spreadsheets, presentations, repos, issues, PRs, AI image/video generation, YouTube search, university coursework, and LinkedIn profiles — all through natural language. Every integration supports downloading media and files to disk.

## What's Included

| Service | Tools | Skills | Docs |
|---------|-------|--------|------|
| Gmail | 10 tools — inbox, search, read, send (with attachments), reply, forward, download attachments, manage | `gmail` | [Setup & Reference](docs/google-workspace.md) |
| Google Calendar | 7 tools — list, view, create, update, delete, RSVP | `calendar` | [Setup & Reference](docs/google-workspace.md) |
| Google Drive | 10 tools — browse, search, read, upload (text & binary), download, organize, share, delete | `drive` | [Setup & Reference](docs/google-workspace.md) |
| Google Docs | 5 tools — create, read, append, find-and-replace, export (PDF/DOCX) | `docs` | [Setup & Reference](docs/google-workspace.md) |
| Google Sheets | 6 tools — create, read, write, append, clear, export (PDF/XLSX/CSV) | `sheets` | [Setup & Reference](docs/google-workspace.md) |
| Google Slides | 5 tools — create, read, add slides, find-and-replace, export (PDF/PPTX) | `slides` | [Setup & Reference](docs/google-workspace.md) |
| GitHub | 18 tools — repos, issues, PRs, code search, notifications, binary file download | `github` | [Setup & Reference](docs/github.md) |
| Gemini AI | 5 tools — image gen, image edit, video gen, video analysis | `gemini` | [Setup & Reference](docs/gemini.md) |
| YouTube | 7 tools — search, video details, transcripts, channels, comments, download thumbnails | `youtube` | [Setup & Reference](docs/youtube.md) |
| Canvas LMS | 11 tools — courses, assignments, grades, announcements, to-do, download files | `canvas` | [Setup & Reference](docs/canvas.md) |
| LinkedIn | 17 tools — profiles, feed, connections, messages, notifications, search, jobs, companies, download media | `linkedin` | [Setup & Reference](docs/linkedin.md) |
| Instagram | 17 tools — profiles, feed, posts, stories, reels, search, followers, DMs, notifications, download media | `instagram` | [Setup & Reference](docs/instagram.md) |

## Quick Start

### 1. Install omniclaw into OpenClaw

```bash
openclaw plugins install --link /path/to/omniclaw
```

Or if running from the OpenClaw monorepo as a built-in extension, place this repo under `extensions/omniclaw/` — the workspace auto-discovers it.

### 2. Set up the integrations you need

Each service has its own authentication. You only need to configure the ones you plan to use.

- **[Google Workspace](docs/google-workspace.md)** — Gmail, Calendar, Drive, Docs, Sheets, Slides (single OAuth2 setup)
- **[GitHub](docs/github.md)** — Personal Access Token
- **[Gemini AI](docs/gemini.md)** — Google AI Studio API key
- **[YouTube](docs/youtube.md)** — Transcripts work with no setup; search/details use Google OAuth
- **[Canvas LMS](docs/canvas.md)** — Browser-based SSO via Playwright
- **[LinkedIn](docs/linkedin.md)** — Browser-based auth via Playwright
- **[Instagram](docs/instagram.md)** — Browser-based auth via Playwright

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # TypeScript compilation
pnpm test             # Run unit tests
pnpm test:integration # Run integration tests (requires real credentials)
```

## Architecture

- **Auth managers** (`src/auth/`) — handle OAuth2, token storage, and per-service authentication
- **Tool factories** (`src/tools/`) — each tool is a factory function returning `{ name, label, description, parameters, execute }`
- **Plugin registration** (`src/plugin.ts`) — the `register(api)` function wires everything together
- **Skills** (`skills/`) — SKILL.md files that teach the agent how to combine tools for each service
- **Multi-account** — every tool accepts an optional `account` parameter (defaults to `"default"`)

## License

MIT
