/**
 * Standalone MCP server entry point using Streamable HTTP transport.
 *
 * Exposes all omniclaw tools over HTTP with Bearer token authentication.
 * Each POST /mcp request establishes or reuses a session keyed by the
 * mcp-session-id header. GET /mcp streams SSE notifications for a session.
 * DELETE /mcp terminates a session.
 *
 * Agent-scoped sessions: pass `x-agent-id` header on the first POST /mcp
 * to scope the session's tool list to that agent's permissions. If omitted,
 * defaults to the first configured agent (backward compatible).
 *
 * Environment variables:
 *   OMNICLAW_MCP_TOKEN   — required, Bearer token for auth
 *   OMNICLAW_MCP_PORT    — port to listen on (default: 9850)
 *   OMNICLAW_MCP_HOST    — host to bind to (default: 0.0.0.0)
 *   OMNICLAW_MCP_CONFIG  — path to plugin config JSON (default: ~/.openclaw/mcp-server-config.json)
 *   OMNICLAW_AGENTS_PATH — path to agents JSON (default: ~/.openclaw/agents.json)
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
import {
  loadAgentConfigs,
  filterToolsForAgent,
  ensureAgentWorkspaces,
  type AgentConfig,
} from "./mcp/agent-config.js";

// ---------------------------------------------------------------------------
// Bootstrap: config + tools + agents
// ---------------------------------------------------------------------------

const config = loadMcpConfig();
const allTools = createAllTools({ pluginConfig: config.plugin });

// Fast lookup by name for dispatch
const toolMap = new Map<string, OmniclawTool>(allTools.map((t) => [t.name, t]));

// Load agent configurations
const agentsFile = loadAgentConfigs(config.agentsPath);
const agentMap = new Map<string, AgentConfig>(agentsFile.agents.map((a) => [a.id, a]));

// Ensure workspace directories exist
ensureAgentWorkspaces(agentsFile.agents);

// ---------------------------------------------------------------------------
// Session store: session ID → { transport, agentId }
// ---------------------------------------------------------------------------

const sessions = new Map<string, { transport: StreamableHTTPServerTransport; agentId: string }>();

// ---------------------------------------------------------------------------
// MCP Server factory — each session gets its own Server + Transport pair,
// scoped to the agent's permitted tools
// ---------------------------------------------------------------------------

function createMcpServerAndTransport(agentId: string): {
  server: Server;
  transport: StreamableHTTPServerTransport;
} {
  const agentConfig = agentMap.get(agentId);

  // Filter tools for this agent; if no agent config found, grant all tools (backward compat)
  const agentTools = agentConfig ? filterToolsForAgent(allTools, agentConfig) : allTools;
  const agentToolMap = new Map<string, OmniclawTool>(agentTools.map((t) => [t.name, t]));

  const server = new Server(
    { name: "omniclaw", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  // tools/list — enumerate tools available to this agent
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: agentTools.map((t) => ({
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
    const tool = agentToolMap.get(toolName);

    if (!tool) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Tool not available for agent "${agentId}": ${toolName}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.execute(
        randomUUID(),
        (request.params.arguments ?? {}) as Record<string, unknown>,
      );
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
  res.json({
    status: "ok",
    tools: toolMap.size,
    sessions: sessions.size,
    agents: agentsFile.agents.length,
  });
});

// GET /agents — list all configured agents (for iOS app discovery)
app.get("/agents", (_req: Request, res: Response) => {
  const agents = agentsFile.agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    colorName: a.colorName,
    services: a.permissions.services,
  }));
  res.json({ agents });
});

// POST /mcp — create new session or route to existing one
app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // Route to existing session transport
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session: determine agent from header (default to first agent for backward compat)
  const agentId =
    (req.headers["x-agent-id"] as string) ?? agentsFile.agents[0]?.id ?? "default";

  const { server, transport } = createMcpServerAndTransport(agentId);
  await server.connect(transport);

  // Store by the session ID the transport assigned (set during handleRequest)
  await transport.handleRequest(req, res, req.body);

  // After handleRequest the session ID is populated
  const assignedId = transport.sessionId;
  if (assignedId) {
    sessions.set(assignedId, { transport, agentId });
  }
});

// GET /mcp — SSE stream for an existing session
app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing mcp-session-id" });
    return;
  }

  const { transport } = sessions.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// DELETE /mcp — terminate a session
app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { transport } = sessions.get(sessionId)!;
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
  console.log(`  agents loaded: ${agentsFile.agents.length} (${agentsFile.agents.map((a) => a.id).join(", ")})`);
  console.log(`  health: http://${config.host}:${config.port}/health`);
});
