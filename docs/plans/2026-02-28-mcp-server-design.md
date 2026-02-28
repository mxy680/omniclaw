# MCP Server Wrapper for Omniclaw

**Date:** 2026-02-28
**Status:** Approved

## Goal

Expose omniclaw's 120+ tools as a remote MCP server using Streamable HTTP transport, accessible from another MacBook over Tailscale. Claude Desktop on the remote Mac connects via `mcp-remote`.

## Architecture

```
Main MacBook (Tailscale IP: 100.x.x.x)
  node dist/mcp-server.js
  Express + Streamable HTTP on 0.0.0.0:9850
  Bearer token auth middleware
  MCP Server with all 120+ tools
  Reuses ~/.openclaw/ token files

Other MacBook (Claude Desktop)
  claude_desktop_config.json:
  "omniclaw": {
    "command": "npx",
    "args": ["mcp-remote", "http://100.x.x.x:9850/mcp",
             "--header", "Authorization: Bearer $TOKEN"]
  }
```

**Approach:** Standalone process (not embedded in OpenClaw plugin). Independently initializes the same auth managers and tool factories that `plugin.ts` uses, but registers them as MCP tools instead of OpenClaw tools.

## Tool Mapping

| Omniclaw | MCP | Notes |
|---|---|---|
| `name` | `name` | Direct 1:1 (e.g. `gmail_get`) |
| `description` | `description` | Direct |
| `parameters` (TypeBox) | `inputSchema` | TypeBox → JSON Schema (native compat) |
| `execute(id, params) → { content }` | handler `→ CallToolResult` | Already returns MCP-compatible shape via `jsonResult()` |

TypeBox schemas produce JSON Schema natively. The MCP SDK's `server.tool()` accepts raw JSON Schema via `{ inputSchema: { ... }, outputSchema: { ... } }`, bypassing Zod entirely.

## Auth & Security

- **Bearer token**: `OMNICLAW_MCP_TOKEN` env var. Middleware checks `Authorization: Bearer <token>` on every request.
- **Tailscale**: Trusted private mesh network. No public internet exposure.
- **Service auth**: Reuses existing `~/.openclaw/` token files (Gmail OAuth, GitHub PAT, browser sessions, etc.).

## Configuration

| Setting | Env Var | Default |
|---|---|---|
| Port | `OMNICLAW_MCP_PORT` | `9850` |
| Host | `OMNICLAW_MCP_HOST` | `0.0.0.0` |
| Auth token | `OMNICLAW_MCP_TOKEN` | (required) |
| Config file | `OMNICLAW_MCP_CONFIG` | `~/.openclaw/mcp-server-config.json` |

The config file provides `PluginConfig` fields (same as `openclaw.plugin.json` config schema) so the MCP server can find `client_secret_path`, token paths, API keys, etc.

## Files

| File | Action | Purpose |
|---|---|---|
| `src/mcp/tool-registry.ts` | **Create** | Extract tool-creation logic from `plugin.ts` into a shared function `createAllTools(config)` that returns an array of tool objects |
| `src/mcp/auth-middleware.ts` | **Create** | Express middleware: validate `Authorization: Bearer <token>` header |
| `src/mcp-server.ts` | **Create** | Entry point: load config, create tools, register as MCP tools, start Express with Streamable HTTP |
| `src/plugin.ts` | **Modify** | Import from `tool-registry.ts` instead of duplicating tool creation |
| `package.json` | **Modify** | Add deps: `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, `@modelcontextprotocol/express`, `express`, `@types/express`. Add `"mcp"` script. |

## Design Details

### `src/mcp/tool-registry.ts`

Extracts the tool-creation logic from `plugin.ts` lines 329-790 into a standalone function:

```typescript
export interface ToolRegistryConfig {
  pluginConfig: PluginConfig;
}

export interface OmniclawTool {
  name: string;
  label: string;
  description: string;
  parameters: TSchema;      // TypeBox schema
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<any>;
}

export function createAllTools(config: ToolRegistryConfig): OmniclawTool[] {
  const tools: OmniclawTool[] = [];
  const add = (t: OmniclawTool) => tools.push(t);

  // Project tools (no auth)
  add(createProjectListTool());
  // ... all 120+ tools, same order as plugin.ts
  // Google OAuth tools gated on client_secret_path presence

  return tools;
}
```

### `src/mcp-server.ts`

```typescript
import { randomUUID } from "node:crypto";
import { McpServer, isInitializeRequest } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { createAllTools } from "./mcp/tool-registry.js";
import { bearerAuth } from "./mcp/auth-middleware.js";

const config = loadConfig();  // from env/file
const tools = createAllTools({ pluginConfig: config });

// Session-based: one MCP server per session
const transports: Record<string, NodeStreamableHTTPServerTransport> = {};

function createServer() {
  const server = new McpServer({ name: "omniclaw", version: "0.1.0" });

  for (const tool of tools) {
    const jsonSchema = JSON.parse(JSON.stringify(tool.parameters));
    server.tool(tool.name, tool.description, jsonSchema, async (params) => {
      const result = await tool.execute(randomUUID(), params);
      return result;  // already { content: [{ type: "text", text: "..." }] }
    });
  }

  return server;
}

const app = createMcpExpressApp();
app.use(bearerAuth(process.env.OMNICLAW_MCP_TOKEN!));

// POST /mcp — handle requests
app.post("/mcp", async (req, res) => { /* session routing */ });
// GET /mcp — SSE streams
app.get("/mcp", async (req, res) => { /* SSE for existing sessions */ });
// DELETE /mcp — terminate sessions
app.delete("/mcp", async (req, res) => { /* cleanup */ });

app.listen(port, host);
```

### `src/mcp/auth-middleware.ts`

```typescript
import type { RequestHandler } from "express";

export function bearerAuth(expectedToken: string): RequestHandler {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${expectedToken}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}
```

### `plugin.ts` refactor

Replace the inline tool registration with:

```typescript
import { createAllTools } from "./mcp/tool-registry.js";

export function register(api: OpenClawPluginApi): void {
  // Channel setup (unchanged)
  setChannelRuntime(api.runtime);
  api.registerChannel({ plugin: iosChannelPlugin as ChannelPlugin });

  const config = (api.pluginConfig ?? {}) as unknown as PluginConfig;
  const tools = createAllTools({ pluginConfig: config });

  for (const tool of tools) {
    api.registerTool(wrapToolWithBroadcast(tool));
  }
}
```

### Excluded tools

The `background_worker` tool depends on OpenClaw's dispatch manager and won't work in standalone mode. It will be excluded from the MCP server (or registered as a no-op that returns an error explaining it requires OpenClaw).

### Client setup (other MacBook)

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "omniclaw": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://100.x.x.x:9850/mcp",
        "--header",
        "Authorization: Bearer YOUR_TOKEN_HERE"
      ]
    }
  }
}
```

### Running the server

```bash
# Start the MCP server
OMNICLAW_MCP_TOKEN="your-secret-token" node dist/mcp-server.js

# Or with a config file
OMNICLAW_MCP_TOKEN="your-secret-token" \
OMNICLAW_MCP_CONFIG="~/.openclaw/mcp-server-config.json" \
node dist/mcp-server.js
```

The `mcp-server-config.json` contains the same fields as `PluginConfig`:

```json
{
  "client_secret_path": "/path/to/client_secret.json",
  "github_token": "ghp_...",
  "gemini_api_key": "...",
  "bluebubbles_url": "http://...",
  "bluebubbles_password": "..."
}
```

## Testing

- Unit test: verify `createAllTools()` returns expected tool count and shapes
- Unit test: verify bearer auth middleware rejects/accepts correctly
- Integration test: start the MCP server, connect with MCP SDK client, call a tool
- Manual test: configure Claude Desktop on other Mac, verify tool list appears and a tool call works
