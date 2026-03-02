# omniclaw — Project Context

## What is OpenClaw?

OpenClaw is a free, open-source, self-hosted personal AI assistant/agent platform. It runs on your own machine (macOS, Linux, Windows via WSL2, Raspberry Pi) and connects to messaging apps you already use (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, etc.).

- **Website:** https://openclaw.ai
- **Docs:** https://docs.openclaw.ai
- **GitHub:** https://github.com/openclaw/openclaw (219k+ stars)
- **Discord:** https://discord.gg/clawd
- **Created by:** Peter Steinberger (@steipete), previously founder of PSPDFKit
- **Naming history:** Clawdbot → Moltbot → OpenClaw (Anthropic trademark complaints)
- **Requires:** Node >= 22

## OpenClaw Architecture

Hub-and-spoke model with the **Gateway** as the central daemon.

```
Messaging Platforms (WhatsApp, Telegram, Discord, Slack, etc.)
        ↓
   ┌──────────────┐
   │   Gateway     │  ← ws://127.0.0.1:18789
   │  (daemon)     │  ← Canvas at :18793
   └──────┬───────┘
          │
   ┌──────┴──────┬──────────┬──────────┐
   Agent       CLI       WebChat    macOS/iOS
   Runtime    Tools       UI        Nodes
```

### Gateway
- The **single long-lived daemon** that owns all messaging surfaces
- Manages session routing, presence, config, cron, webhooks, and plugins
- Plugins run **in-process** with the Gateway (trusted code)
- WebSocket protocol: `connect` → `{type:"req"}` / `{type:"res"}` / `{type:"event"}`
- Start with: `openclaw gateway`

### Agent Runtime
- Assembles context from session history and memory
- Invokes the model (Claude recommended; also supports OpenAI, local models)
- Executes tool calls and persists state

### Configuration
- Primary config: `~/.openclaw/openclaw.json`
- Workspace root: `~/.openclaw/workspace`

## Plugin System

### Plugin Manifest (`openclaw.plugin.json`)
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "skills": ["skills"],
  "configSchema": { /* JSON Schema */ },
  "uiHints": { "field": { "label": "Display Name", "sensitive": true } }
}
```

### Plugin Entry Point
Default export an object with `id`, `name`, `description`, `version`, and a `register(api)` function:

```typescript
export default {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  register(api) { ... }
};
```

### Plugin API (`api`)
| Method | Purpose |
|---|---|
| `api.pluginConfig` | Plugin configuration from `openclaw.json` |
| `api.logger.warn()` | Logging |
| `api.registerTool(tool, opts)` | Register an agent tool |

### Tool Definition
```typescript
api.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What it does",
  parameters: Type.Object({ input: Type.String() }),
  async execute(toolCallId: string, params) {
    return {
      content: [{ type: "text", text: "result" }],
      details: { structured: "data" }
    };
  },
}, { optional: true });
```

### Skills System

Skills are documentation bundles (Markdown "textbooks") that teach the agent how to combine tools.

---

## This Project: omniclaw

**omniclaw** is a Google Workspace MCP server / OpenClaw plugin providing Gmail, Calendar, Drive, Docs, Sheets, Slides, and YouTube tools.

### File Structure
```
omniclaw/
├── openclaw.plugin.json          # Plugin manifest
├── package.json                  # deps, build, test scripts
├── tsconfig.json                 # TS → ESM, dist/
├── vitest.config.ts
├── src/
│   ├── index.ts                  # Plugin entry point (default export)
│   ├── plugin.ts                 # register() — creates oauth client, registers tools
│   ├── mcp-server.ts             # Standalone MCP server entry point
│   ├── mcp/
│   │   ├── tool-registry.ts      # Master tool registry — creates all tool instances
│   │   ├── auth-middleware.ts     # MCP auth middleware
│   │   └── config.ts             # MCP config loader
│   ├── auth/
│   │   ├── gmail-auth.ts         # createOAuthClient(), getAuthUrl()
│   │   ├── oauth-client-manager.ts # Multi-account OAuth client manager
│   │   ├── oauth-server.ts       # waitForOAuthCallback() — local HTTP server
│   │   └── token-store.ts        # TokenStore class — file-based, multi-account
│   ├── tools/                    # ~43 Google Workspace tool files
│   └── types/
│       └── plugin-config.ts      # PluginConfig interface
├── skills/                       # 7 SKILL.md files + index
├── docs/
│   ├── google-workspace.md
│   └── youtube.md
└── tests/
    ├── token-store.test.ts
    ├── unit/
    │   ├── mcp-auth-middleware.test.ts
    │   └── tool-registry.test.ts
    └── integration/
        └── *.test.ts             # Live API tests
```

### Tools (~55 total)
| Service | Tools |
|---|---|
| Gmail | 10 — inbox, search, read, send (with attachments), reply, forward, download attachments, manage |
| Google Calendar | 8 — auth, list calendars, events, get, create, update, delete, RSVP |
| Google Drive | 11 — auth, browse, search, read, upload, download, organize, share, delete |
| Google Docs | 6 — auth, create, read, append, find-and-replace, export |
| Google Sheets | 7 — auth, create, read, write, append, clear, export |
| Google Slides | 6 — auth, create, read, add slides, find-and-replace, export |
| YouTube | 7 — auth, search, video details, transcripts, channels, comments, download thumbnails |

### OAuth Setup
- Scopes: gmail.modify, calendar, drive, docs, sheets, slides, youtube.readonly
- Redirect: `http://localhost:9753/oauth/callback`
- Tokens: `~/.openclaw/omniclaw-tokens.json`
- Client secret: user-provided from Google Cloud Console

### Key Patterns
- **Multi-account:** every tool accepts `account?` param (defaults to `"default"`)
- **Auth guard:** all tools check `tokenStore.has(account)`, return `{error: "auth_required"}` if missing
- **Token refresh:** `oauthClient.on("tokens", ...)` listener persists refreshed tokens automatically
- **Result format:** `{ content: [{type: "text", text: JSON}], details: structured_object }`
- **Parameters:** `@sinclair/typebox` for JSON Schema definitions

### Commands
```bash
pnpm build                        # TypeScript → dist/
pnpm test                         # Unit tests (mocked)
pnpm test:integration             # Integration tests (real API)
OMNICLAW_MCP_TOKEN=dev pnpm mcp:dev  # Start MCP server locally
```
