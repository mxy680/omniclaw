# MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose omniclaw's 120+ tools as a remote MCP server over Streamable HTTP, accessible via Tailscale from another MacBook running Claude Desktop.

**Architecture:** Standalone Node.js process using the low-level MCP `Server` class with Express + `NodeStreamableHTTPServerTransport`. TypeBox schemas pass through as raw JSON Schema (no Zod needed). Bearer token auth on the Express layer.

**Tech Stack:** `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, `express`, TypeScript, Node.js

**Design doc:** `docs/plans/2026-02-28-mcp-server-design.md`

---

### Task 1: Add MCP SDK and Express dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install dependencies**

Run:
```bash
cd /Users/markshteyn/omniclaw && pnpm add @modelcontextprotocol/server @modelcontextprotocol/node express && pnpm add -D @types/express
```

Expected: packages added to `package.json` dependencies/devDependencies

**Step 2: Verify build still works**

Run: `pnpm build`
Expected: PASS (no source changes yet)

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add MCP SDK and Express dependencies"
```

---

### Task 2: Create tool-registry.ts — extract tool creation from plugin.ts

This is the largest task. Extract all tool-creation logic from `plugin.ts` (lines 329-790) into a standalone function.

**Files:**
- Create: `src/mcp/tool-registry.ts`

**Step 1: Write the failing test**

Create: `tests/unit/tool-registry.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { createAllTools, type OmniclawTool } from "../../src/mcp/tool-registry.js";

describe("createAllTools", () => {
  it("returns an array of tools with correct shape", () => {
    // Minimal config — no Google OAuth, so Google tools won't be created
    const tools = createAllTools({
      pluginConfig: {} as any,
    });

    expect(tools.length).toBeGreaterThan(50);

    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe("string");
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe("string");
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe("object");
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("includes Google tools when client_secret_path is provided", () => {
    // This will fail to actually auth but the tools should still be created
    const tools = createAllTools({
      pluginConfig: {
        client_secret_path: "/tmp/fake-secret.json",
      } as any,
    });

    const gmailTools = tools.filter((t) => t.name.startsWith("gmail_"));
    expect(gmailTools.length).toBeGreaterThan(0);
  });

  it("has unique tool names", () => {
    const tools = createAllTools({ pluginConfig: {} as any });
    const names = tools.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/tool-registry.test.ts`
Expected: FAIL — `createAllTools` does not exist yet

**Step 3: Implement tool-registry.ts**

Create `src/mcp/tool-registry.ts`. This extracts the tool-creation logic from `plugin.ts`, copying all the imports and the manager-initialization + tool-creation code. The function returns an array instead of calling `api.registerTool()`.

Key differences from `plugin.ts`:
- No `api.registerTool()` / `api.registerChannel()` — just push tools to array
- No `wrapToolWithBroadcast()` — raw tools only
- No `background_worker` tool (depends on OpenClaw dispatch manager)
- No channel setup
- Google tools gated on `client_secret_path` but don't early-return (just skip them)

The file should:
1. Copy all tool factory imports from `plugin.ts` (lines 15-274)
2. Copy all client manager imports from `plugin.ts` (lines 9-14, 54, 68, 158-159, 181, 189, 214, 228)
3. Define `OmniclawTool` interface and `createAllTools()` function
4. Inside `createAllTools()`: replicate the manager-creation + tool-registration from `plugin.ts` lines 329-790, but push to an array instead of calling `reg()`
5. Export `activeNutritionDb` getter for backward compat

```typescript
import * as os from "os";
import * as path from "path";
import type { PluginConfig } from "../types/plugin-config.js";
// ... all the tool factory imports (copy from plugin.ts lines 15-274, excluding channel/runtime imports)
// ... all the client manager imports

export interface OmniclawTool {
  name: string;
  label: string;
  description: string;
  parameters: any; // TypeBox TSchema — JSON Schema compatible
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<any>;
}

let _activeNutritionDb: NutritionDbManager | null = null;
export function getActiveNutritionDb(): NutritionDbManager | null {
  return _activeNutritionDb;
}

export function createAllTools(opts: { pluginConfig: PluginConfig }): OmniclawTool[] {
  const config = opts.pluginConfig;
  const tools: OmniclawTool[] = [];
  const add = (t: OmniclawTool) => tools.push(t);
  const defaultTokensDir = path.join(os.homedir(), ".openclaw");

  // Project tools (no auth)
  add(createProjectListTool());
  add(createProjectCreateTool());
  add(createProjectUpdateTool());
  add(createProjectDeleteTool());
  add(createProjectAddLinkTool());
  add(createProjectRemoveLinkTool());
  add(createProjectCodeEditTool());

  // Memory tools
  add(createMemorySaveTool());
  add(createMemoryReadTool());
  add(createMemoryListTool());
  add(createMemoryDeleteTool());
  add(createMemoryUpdateIndexTool());

  // NOTE: background_worker excluded — requires OpenClaw dispatch manager

  // Canvas
  const canvasTokensPath = config.canvas_tokens_path ??
    path.join(config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir, "omniclaw-canvas-tokens.json");
  const canvasManager = new CanvasClientManager(canvasTokensPath);
  add(createCanvasAuthTool(canvasManager, config));
  add(createCanvasProfileTool(canvasManager));
  // ... (all canvas tools — copy exact pattern from plugin.ts lines 391-401)

  // GitHub
  const githubTokensPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-github-tokens.json")
    : path.join(defaultTokensDir, "omniclaw-github-tokens.json");
  const githubManager = new GitHubClientManager(githubTokensPath);
  add(createGitHubAuthTool(githubManager, config));
  // ... (all GitHub tools — copy from plugin.ts lines 411-427)

  // Gemini, LinkedIn, Instagram, TikTok, Factor75, Slack, Vercel, X, Nutrition, YouTube (no-auth), iMessage
  // ... (copy exact patterns from plugin.ts for each block)

  // Google OAuth tools — only if client_secret_path is configured
  if (config.client_secret_path) {
    const tokensPath = config.tokens_path ?? path.join(os.homedir(), ".openclaw", "omniclaw-tokens.json");
    const tokenStore = new TokenStore(tokensPath);
    const clientManager = new OAuthClientManager(config.client_secret_path, config.oauth_port ?? 9753, tokenStore);

    add(createGmailInboxTool(clientManager));
    // ... (all Gmail, Calendar, Drive, Docs, Slides, Sheets, YouTube OAuth tools — copy from plugin.ts lines 731-789)
  }

  return tools;
}
```

The actual implementation will copy ALL tool registrations verbatim from `plugin.ts`. The pseudocode above shows the pattern — the real file will have every single `add(create...Tool(...))` call.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/tool-registry.test.ts`
Expected: PASS — all 3 tests green

**Step 5: Build**

Run: `pnpm build`
Expected: PASS

**Step 6: Commit**

```bash
git add src/mcp/tool-registry.ts tests/unit/tool-registry.test.ts
git commit -m "feat(mcp): create tool-registry with createAllTools()"
```

---

### Task 3: Refactor plugin.ts to use tool-registry

**Files:**
- Modify: `src/plugin.ts`

**Step 1: Refactor plugin.ts**

Replace the inline tool creation (lines 329-790) with a call to `createAllTools()`, then iterate and register. Keep the channel setup and `wrapToolWithBroadcast` as-is. Keep the `background_worker` tool inline (it depends on OpenClaw-specific context).

After refactor, `plugin.ts` should:
1. Import `createAllTools` from `./mcp/tool-registry.js`
2. Remove all tool factory imports (they're now in tool-registry.ts)
3. Remove all client manager imports except those needed for background_worker
4. Keep: channel imports, `wrapToolWithBroadcast`, `truncateStr`, `activeNutritionDb` (re-export from tool-registry)
5. Call `createAllTools({ pluginConfig: config })` and loop to register

```typescript
import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { iosChannelPlugin, getDispatchManager } from "./channel/channel-plugin.js";
import { setChannelRuntime } from "./channel/runtime.js";
import { createAllTools, getActiveNutritionDb } from "./mcp/tool-registry.js";
import { createBackgroundWorkerTool } from "./tools/background-worker.js";
import type { PluginConfig } from "./types/plugin-config.js";
import { getWsServer } from "./channel/send.js";
import { getActiveContext } from "./channel/active-context.js";

// Re-export for backward compat
export { getActiveNutritionDb as getNutritionDb } from "./mcp/tool-registry.js";

type OpenClawPluginApi = any;

function truncateStr(val: unknown, max = 200): string {
  const s = typeof val === "string" ? val : JSON.stringify(val);
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function wrapToolWithBroadcast(tool: any): any {
  // ... unchanged from current plugin.ts lines 282-318
}

export function register(api: OpenClawPluginApi): void {
  setChannelRuntime(api.runtime);
  api.registerChannel({ plugin: iosChannelPlugin as ChannelPlugin });

  const reg = (tool: any) => api.registerTool(wrapToolWithBroadcast(tool));

  const config = (api.pluginConfig ?? {}) as unknown as PluginConfig;
  const tools = createAllTools({ pluginConfig: config });

  for (const tool of tools) {
    reg(tool);
  }

  // Background worker — depends on OpenClaw dispatch manager, registered separately
  reg(createBackgroundWorkerTool({
    submitBackground: async (req) => {
      // ... unchanged from current plugin.ts lines 346-375
    },
  }));
}
```

**Step 2: Build**

Run: `pnpm build`
Expected: PASS

**Step 3: Run existing tests**

Run: `pnpm test`
Expected: PASS — all existing unit tests still pass (behavior unchanged)

**Step 4: Commit**

```bash
git add src/plugin.ts
git commit -m "refactor: extract tool creation to tool-registry, plugin.ts now delegates"
```

---

### Task 4: Create auth middleware and config loader

**Files:**
- Create: `src/mcp/auth-middleware.ts`
- Create: `src/mcp/config.ts`

**Step 1: Write failing test for auth middleware**

Create: `tests/unit/mcp-auth-middleware.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { bearerAuth } from "../../src/mcp/auth-middleware.js";

function mockReqResNext(authHeader?: string) {
  const req = { headers: { authorization: authHeader } } as any;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe("bearerAuth", () => {
  const middleware = bearerAuth("test-secret");

  it("calls next() for valid token", () => {
    const { req, res, next } = mockReqResNext("Bearer test-secret");
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 for missing header", () => {
    const { req, res, next } = mockReqResNext(undefined);
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for wrong token", () => {
    const { req, res, next } = mockReqResNext("Bearer wrong-token");
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for non-Bearer scheme", () => {
    const { req, res, next } = mockReqResNext("Basic dXNlcjpwYXNz");
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/mcp-auth-middleware.test.ts`
Expected: FAIL — module not found

**Step 3: Implement auth-middleware.ts**

Create `src/mcp/auth-middleware.ts`:

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

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/mcp-auth-middleware.test.ts`
Expected: PASS

**Step 5: Implement config.ts**

Create `src/mcp/config.ts`:

```typescript
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { PluginConfig } from "../types/plugin-config.js";

export interface McpServerConfig {
  port: number;
  host: string;
  authToken: string;
  plugin: PluginConfig;
}

export function loadMcpConfig(): McpServerConfig {
  const authToken = process.env.OMNICLAW_MCP_TOKEN;
  if (!authToken) {
    console.error("OMNICLAW_MCP_TOKEN is required. Set it as an environment variable.");
    process.exit(1);
  }

  const port = parseInt(process.env.OMNICLAW_MCP_PORT ?? "9850", 10);
  const host = process.env.OMNICLAW_MCP_HOST ?? "0.0.0.0";

  // Load plugin config from JSON file
  const configPath =
    process.env.OMNICLAW_MCP_CONFIG ??
    path.join(os.homedir(), ".openclaw", "mcp-server-config.json");

  let plugin: PluginConfig = {} as PluginConfig;
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    plugin = JSON.parse(raw) as PluginConfig;
  } else {
    console.warn(`Config file not found at ${configPath} — running with defaults (no Google OAuth tools).`);
  }

  return { port, host, authToken, plugin };
}
```

**Step 6: Build**

Run: `pnpm build`
Expected: PASS

**Step 7: Commit**

```bash
git add src/mcp/auth-middleware.ts src/mcp/config.ts tests/unit/mcp-auth-middleware.test.ts
git commit -m "feat(mcp): add bearer auth middleware and config loader"
```

---

### Task 5: Create MCP server entry point

**Files:**
- Create: `src/mcp-server.ts`

**Step 1: Implement mcp-server.ts**

Uses the low-level `Server` class from `@modelcontextprotocol/server` with method string handlers. This lets us pass TypeBox JSON Schema directly to the MCP wire protocol without any Zod conversion.

Create `src/mcp-server.ts`:

```typescript
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import express from "express";
import { createAllTools, type OmniclawTool } from "./mcp/tool-registry.js";
import { bearerAuth } from "./mcp/auth-middleware.js";
import { loadMcpConfig } from "./mcp/config.js";

const config = loadMcpConfig();
const tools = createAllTools({ pluginConfig: config.plugin });
const toolMap = new Map<string, OmniclawTool>(tools.map((t) => [t.name, t]));

console.log(`Loaded ${tools.length} tools`);

// ── Session management ──────────────────────────────────────────────────────

const transports: Record<string, NodeStreamableHTTPServerTransport> = {};

function createMcpServer(): Server {
  const server = new Server(
    { name: "omniclaw", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler("tools/list", async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: "object" as const,
        properties: t.parameters.properties ?? {},
        ...(t.parameters.required?.length ? { required: t.parameters.required } : {}),
      },
    })),
  }));

  server.setRequestHandler("tools/call", async (request) => {
    const name = request.params.name;
    const tool = toolMap.get(name);
    if (!tool) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    try {
      const result = await tool.execute(randomUUID(), request.params.arguments ?? {});
      // omniclaw tools return { content: [{ type: "text", text: "..." }], details: ... }
      // MCP expects { content: [{ type: "text", text: "..." }] }
      return { content: result.content ?? [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ── Express app ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(bearerAuth(config.authToken));

// POST /mcp — main request handler
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Existing session
  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res, req.body);
    return;
  }

  // New session — create transport + server
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sid: string) => {
      transports[sid] = transport;
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      delete transports[transport.sessionId];
    }
  };

  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// GET /mcp — SSE stream for existing sessions
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).json({ error: "Invalid or missing session" });
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

// DELETE /mcp — session termination
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res);
  } else {
    res.status(400).json({ error: "Invalid or missing session" });
  }
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", tools: tools.length, sessions: Object.keys(transports).length });
});

// ── Start ───────────────────────────────────────────────────────────────────

app.listen(config.port, config.host, () => {
  console.log(`Omniclaw MCP server listening on http://${config.host}:${config.port}/mcp`);
  console.log(`${tools.length} tools registered`);
  console.log(`Health check: http://${config.host}:${config.port}/health`);
});
```

**Step 2: Build**

Run: `pnpm build`
Expected: PASS

**Step 3: Smoke test — start the server**

Run:
```bash
OMNICLAW_MCP_TOKEN="test123" node dist/mcp-server.js
```

Expected output:
```
Config file not found at ... — running with defaults (no Google OAuth tools).
Loaded N tools
Omniclaw MCP server listening on http://0.0.0.0:9850/mcp
N tools registered
Health check: http://0.0.0.0:9850/health
```

Verify health endpoint in another terminal:
```bash
curl -H "Authorization: Bearer test123" http://localhost:9850/health
```

Expected: `{"status":"ok","tools":N,"sessions":0}`

Ctrl+C to stop.

**Step 4: Commit**

```bash
git add src/mcp-server.ts
git commit -m "feat(mcp): add standalone MCP server entry point with Streamable HTTP"
```

---

### Task 6: Add npm scripts and integration test

**Files:**
- Modify: `package.json` (add scripts)
- Create: `tests/integration/mcp-server.test.ts`

**Step 1: Add scripts to package.json**

Add to `scripts`:
```json
{
  "mcp": "node dist/mcp-server.js",
  "mcp:dev": "tsx src/mcp-server.ts"
}
```

**Step 2: Write integration test**

Create `tests/integration/mcp-server.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";

const PORT = 19850; // Use non-standard port for tests
const TOKEN = "test-integration-token";

let serverProc: ChildProcess;

async function waitForServer(url: string, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

describe("MCP Server Integration", () => {
  beforeAll(async () => {
    serverProc = spawn("node", ["dist/mcp-server.js"], {
      env: {
        ...process.env,
        OMNICLAW_MCP_TOKEN: TOKEN,
        OMNICLAW_MCP_PORT: String(PORT),
      },
      stdio: "pipe",
    });
    await waitForServer(`http://localhost:${PORT}/health`);
  }, 15000);

  afterAll(() => {
    serverProc?.kill("SIGTERM");
  });

  it("health endpoint returns tool count", async () => {
    const res = await fetch(`http://localhost:${PORT}/health`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.tools).toBeGreaterThan(50);
  });

  it("rejects requests without auth token", async () => {
    const res = await fetch(`http://localhost:${PORT}/health`);
    expect(res.status).toBe(401);
  });

  it("rejects requests with wrong auth token", async () => {
    const res = await fetch(`http://localhost:${PORT}/health`, {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("responds to MCP initialize via POST /mcp", async () => {
    const res = await fetch(`http://localhost:${PORT}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    // May be SSE format or JSON — check it contains the server name
    expect(text).toContain("omniclaw");
  });
});
```

**Step 3: Build and run integration test**

Run: `pnpm build && pnpm vitest run tests/integration/mcp-server.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add package.json tests/integration/mcp-server.test.ts
git commit -m "feat(mcp): add npm scripts and integration test for MCP server"
```

---

### Task 7: Final verification and cleanup

**Step 1: Run all unit tests**

Run: `pnpm test`
Expected: PASS

**Step 2: Run MCP integration test**

Run: `pnpm build && pnpm vitest run tests/integration/mcp-server.test.ts`
Expected: PASS

**Step 3: Verify server starts with real config**

If you have a `~/.openclaw/mcp-server-config.json`, start the server and verify all tools load:

```bash
OMNICLAW_MCP_TOKEN="your-real-token" pnpm mcp
```

Expected: All 120+ tools registered, health endpoint confirms count.

**Step 4: Test from another machine (manual)**

On the other MacBook:
1. Install `mcp-remote`: `npm install -g mcp-remote`
2. Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "omniclaw": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://YOUR_TAILSCALE_IP:9850/mcp",
        "--header",
        "Authorization: Bearer YOUR_TOKEN"
      ]
    }
  }
}
```

3. Restart Claude Desktop
4. Verify omniclaw tools appear in the tool list
5. Try a read-only tool call (e.g. `gmail_inbox` or `github_repos`)

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(mcp): complete MCP server with remote access via Streamable HTTP"
```
