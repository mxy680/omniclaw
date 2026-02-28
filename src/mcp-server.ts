/**
 * Standalone MCP server entry point using Streamable HTTP transport.
 *
 * Exposes all omniclaw tools over HTTP with Bearer token authentication.
 * Each POST /mcp request establishes or reuses a session keyed by the
 * mcp-session-id header. GET /mcp streams SSE notifications for a session.
 * DELETE /mcp terminates a session.
 *
 * Environment variables:
 *   OMNICLAW_MCP_TOKEN  — required, Bearer token for auth
 *   OMNICLAW_MCP_PORT   — port to listen on (default: 9850)
 *   OMNICLAW_MCP_HOST   — host to bind to (default: 0.0.0.0)
 *   OMNICLAW_MCP_CONFIG — path to plugin config JSON (default: ~/.openclaw/mcp-server-config.json)
 */

import { randomUUID } from "crypto";
import express from "express";
import type { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { loadMcpConfig } from "./mcp/config.js";
import { bearerAuth } from "./mcp/auth-middleware.js";
import { createAllTools, type OmniclawTool } from "./mcp/tool-registry.js";

// ---------------------------------------------------------------------------
// Bootstrap: config + tools
// ---------------------------------------------------------------------------

const config = loadMcpConfig();
const allTools = createAllTools({ pluginConfig: config.plugin });

// Fast lookup by name for dispatch
const toolMap = new Map<string, OmniclawTool>(allTools.map((t) => [t.name, t]));

// ---------------------------------------------------------------------------
// Session store: session ID → transport instance
// ---------------------------------------------------------------------------

const sessions = new Map<string, StreamableHTTPServerTransport>();

// ---------------------------------------------------------------------------
// MCP Server factory — each session gets its own Server + Transport pair
// ---------------------------------------------------------------------------

function createMcpServerAndTransport(): {
  server: Server;
  transport: StreamableHTTPServerTransport;
} {
  const server = new Server(
    { name: "omniclaw", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  // tools/list — enumerate all registered tools with their JSON Schema
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          type: "object" as const,
          properties: t.parameters?.properties ?? {},
          required: t.parameters?.required ?? [],
        },
      })),
    };
  });

  // tools/call — dispatch to matching tool's execute()
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = toolMap.get(toolName);

    if (!tool) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    try {
      const result = await tool.execute(randomUUID(), (request.params.arguments ?? {}) as Record<string, unknown>);
      // Tools return { content: [...], details: ... } via jsonResult()
      const typed = result as { content: Array<{ type: string; text: string }> };
      return { content: typed.content };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Tool error: ${message}` }],
        isError: true,
      };
    }
  });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  // Remove session entry when the transport closes
  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) {
      sessions.delete(sessionId);
    }
  };

  return { server, transport };
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use(bearerAuth(config.authToken));

// Health check — no session needed
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", tools: toolMap.size, sessions: sessions.size });
});

// POST /mcp — create new session or route to existing one
app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // Route to existing session transport
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session: create server + transport pair, connect them, then handle
  const { server, transport } = createMcpServerAndTransport();
  await server.connect(transport);

  // Store by the session ID the transport assigned (set during handleRequest)
  await transport.handleRequest(req, res, req.body);

  // After handleRequest the session ID is populated
  const assignedId = transport.sessionId;
  if (assignedId) {
    sessions.set(assignedId, transport);
  }
});

// GET /mcp — SSE stream for an existing session
app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing mcp-session-id" });
    return;
  }

  const transport = sessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// DELETE /mcp — terminate a session
app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const transport = sessions.get(sessionId)!;
  await transport.close();
  sessions.delete(sessionId);
  res.status(200).json({ status: "closed" });
});

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------

app.listen(config.port, config.host, () => {
  console.log(`omniclaw MCP server listening on http://${config.host}:${config.port}`);
  console.log(`  tools registered: ${toolMap.size}`);
  console.log(`  health: http://${config.host}:${config.port}/health`);
});
