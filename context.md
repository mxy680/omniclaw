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

## OpenClaw CLI Commands

```bash
openclaw onboard                  # Interactive setup
openclaw gateway                  # Start the Gateway daemon
openclaw agent --message "..."    # Run one agent turn
openclaw plugins list|install|enable|disable
openclaw plugins config <name>    # Configure a plugin
openclaw skills list|info|enable|disable
openclaw config get|set|unset     # Config management
openclaw doctor                   # Diagnostics
openclaw security audit           # Security audit
openclaw logs --follow            # Tail logs
```

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
| `api.registerGatewayMethod()` | Create RPC methods |
| `api.registerCli()` | Add CLI commands |
| `api.registerCommand()` | Auto-reply slash commands |
| `api.registerService()` | Background services with start/stop |
| `api.registerHook()` | Event-driven automation hooks |
| `api.registerChannel()` | Messaging channel adapters |
| `api.registerProvider()` | Model provider auth flows |

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

- **required** tools: always available to the agent
- **optional** tools (`{ optional: true }`): must be enabled in agent config

### Plugin Installation
```bash
openclaw plugins install @openclaw/voice-call     # npm
openclaw plugins install ./local-plugin            # local dir
openclaw plugins install -l ./extensions/my-plugin # link (dev)
```

### Plugin Config in `openclaw.json`
```json
{
  "plugins": {
    "entries": {
      "omniclaw": {
        "enabled": true,
        "config": {
          "client_secret_path": "/path/to/client_secret.json"
        }
      }
    }
  }
}
```

Or set via CLI:
```bash
openclaw config set plugins.entries.omniclaw.config.client_secret_path "/path/to/client_secret.json"
```

## Skills System

Skills are documentation bundles (Markdown "textbooks") that teach the agent how to combine tools. Each skill lives in a directory with a `SKILL.md` file.

### SKILL.md Format
```markdown
---
name: my-skill
description: Short description
metadata:
  openclaw:
    emoji: "🔧"
    requires:
      bins: ["some-binary"]
      env: ["SOME_API_KEY"]
---

# My Skill

Instructions, workflow steps, available tools, etc.
```

### How Skills Work at Runtime
1. At session start, skill metadata is read and eligibility checked
2. A compact XML list of eligible skills is injected into the system prompt
3. The agent invokes skills during execution as needed

### Skill Management
```bash
openclaw skills list
openclaw skills enable <name>
openclaw skills disable <name>
openclaw skills install github:user/skill-name
```

### ClawHub (Community Skill Registry)
- https://clawhub.ai
- https://github.com/openclaw/clawhub

---

## This Project: omniclaw

**omniclaw** is an OpenClaw plugin providing Gmail integration via Google OAuth2.

### File Structure
```
omniclaw/
├── openclaw.plugin.json          # Plugin manifest
├── package.json                  # deps, build, test scripts
├── tsconfig.json                 # TS → CommonJS, dist/
├── vitest.config.ts
├── src/
│   ├── index.ts                  # Plugin entry point (default export)
│   ├── plugin.ts                 # register() — creates oauth client, registers tools
│   ├── auth/
│   │   ├── gmail-auth.ts         # createOAuthClient(), getAuthUrl() [gmail.modify scope]
│   │   ├── oauth-server.ts       # waitForOAuthCallback() — local HTTP server
│   │   └── token-store.ts        # TokenStore class — file-based, multi-account
│   ├── tools/
│   │   ├── gmail-auth-tool.ts    # gmail_auth_setup
│   │   ├── gmail-inbox.ts        # gmail_inbox, gmail_search
│   │   ├── gmail-get.ts          # gmail_get
│   │   ├── gmail-send.ts         # gmail_send, gmail_reply, gmail_forward
│   │   └── gmail-modify.ts       # gmail_modify
│   └── types/
│       └── plugin-config.ts      # PluginConfig interface
├── skills/
│   └── gmail.SKILL.md            # Skill definition for agents
├── scripts/
│   └── reauth.ts                 # Standalone re-auth: npx tsx scripts/reauth.ts
└── tests/
    ├── token-store.test.ts
    ├── gmail-inbox.test.ts
    ├── gmail-get.test.ts
    ├── gmail-send.test.ts
    ├── gmail-modify.test.ts
    └── integration/
        └── gmail.test.ts         # Live API tests (real credentials)
```

### Tools (8 total)
| Tool | Purpose |
|---|---|
| `gmail_auth_setup` | OAuth2 browser flow, saves token |
| `gmail_inbox` | List recent inbox messages (id, subject, from, date, snippet) |
| `gmail_search` | Search with Gmail query syntax |
| `gmail_get` | Fetch full message body (text + HTML) by ID |
| `gmail_send` | Compose and send a new email |
| `gmail_reply` | Reply in-thread (In-Reply-To, References, threadId) |
| `gmail_forward` | Forward with quoted original body |
| `gmail_modify` | mark_read, mark_unread, archive, trash |

### OAuth Setup
- Scope: `gmail.modify` (read + send + label + archive + trash, but NOT permanent delete)
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
pnpm test:integration             # Integration tests (real Gmail API)
RUN_WRITE_TESTS=1 pnpm test:integration  # Include send/reply/forward tests
npx tsx scripts/reauth.ts         # Re-authenticate (new scope, etc.)
```

### Current Credentials
- Client secret: `/Users/markshteyn/Downloads/client_secret_772791512967-bb4nvpsu9umlr74nt12cjvloaq6hcale.apps.googleusercontent.com.json`
- Tokens: `~/.openclaw/omniclaw-tokens.json` (account: `"default"`)
- Token was issued with `gmail.readonly` scope — needs re-auth for `gmail.modify`
