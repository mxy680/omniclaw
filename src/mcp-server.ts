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
 *   OMNICLAW_MCP_TOKEN        — required, Bearer token for auth
 *   OMNICLAW_MCP_PORT         — port to listen on (default: 9850)
 *   OMNICLAW_MCP_HOST         — host to bind to (default: 0.0.0.0)
 *   OMNICLAW_MCP_CONFIG       — path to plugin config JSON (default: ~/.openclaw/mcp-server-config.json)
 *   OMNICLAW_AGENTS_PATH      — path to agents JSON (default: ~/.openclaw/agents.json)
 *   OMNICLAW_GATEWAY_URL      — gateway WebSocket URL for scheduler (default: ws://localhost:18789)
 *   OMNICLAW_GATEWAY_TOKEN    — gateway auth token (default: reuses MCP token)
 *   OMNICLAW_SCHEDULES_PATH   — path to schedules JSON (default: ~/.openclaw/schedules.json)
 *   OMNICLAW_SCHEDULER_ENABLED — enable cron scheduler (default: true)
 */

import { randomUUID } from "crypto";
import express from "express";
import type { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { loadMcpConfig } from "./mcp/config.js";
import { saveAttachment, type AttachmentMeta } from "./tools/attachment-store.js";
import { bearerAuth } from "./mcp/auth-middleware.js";
import { createAllTools, type OmniclawTool } from "./mcp/tool-registry.js";
import {
  loadAgentConfigs,
  loadAgentSoul,
  filterToolsForAgent,
  ensureAgentWorkspaces,
  type AgentConfig,
} from "./mcp/agent-config.js";
import { SchedulerService, type ScheduleJob } from "./scheduler/index.js";

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
      const typed = result as { content: Array<Record<string, unknown>> };
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

// Attachment upload — registered before global middleware so express.json() does
// not consume the raw body stream.  Accepts either the MCP token or the gateway
// token (iOS clients only know the gateway token).
app.post("/api/attachments", express.raw({ type: "*/*", limit: "20mb" }), (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  const validToken =
    (config.authToken && auth === `Bearer ${config.authToken}`) ||
    (config.gatewayToken && auth === `Bearer ${config.gatewayToken}`);
  if (config.authToken && !validToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const filename = (req.headers["x-filename"] as string) || "upload.bin";
  const mimeType = (req.headers["content-type"] as string) || "application/octet-stream";

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: "Empty body" });
    return;
  }

  try {
    const meta: AttachmentMeta = saveAttachment(req.body, filename, mimeType);
    res.json(meta);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

app.use(express.json());
if (config.authToken) {
  app.use(bearerAuth(config.authToken));
}

// Health check — no session needed
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    tools: toolMap.size,
    sessions: sessions.size,
    agents: agentsFile.agents.map((a) => ({
      agentId: a.id,
      name: a.name,
      role: a.role,
      colorName: a.colorName,
      services: a.permissions.services,
    })),
    scheduler: scheduler
      ? { enabled: true, jobs: scheduler.getStore().listJobs().length, activeRuns: scheduler.getActiveRuns().length }
      : { enabled: false },
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
    soul: loadAgentSoul(a),
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
// Scheduler
// ---------------------------------------------------------------------------

let scheduler: SchedulerService | null = null;

if (config.schedulerEnabled && config.gatewayUrl) {
  scheduler = new SchedulerService({
    gateway: { url: config.gatewayUrl, authToken: config.gatewayToken },
    agentMap,
    schedulesPath: config.schedulesPath,
  });
  scheduler.start();
}

// ---------------------------------------------------------------------------
// Schedule REST API
// ---------------------------------------------------------------------------

// GET /api/schedules — list all scheduled jobs
app.get("/api/schedules", (_req: Request, res: Response) => {
  if (!scheduler) {
    res.status(503).json({ error: "Scheduler not enabled" });
    return;
  }
  const jobs = scheduler.getStore().listJobs();
  const enriched = jobs.map((job) => ({ ...job, ...scheduler!.getJobStatus(job.id) }));
  res.json({ jobs: enriched });
});

// GET /api/schedules/:id — get a single job
app.get("/api/schedules/:id", (req: Request, res: Response) => {
  if (!scheduler) { res.status(503).json({ error: "Scheduler not enabled" }); return; }
  const id = req.params.id as string;
  const job = scheduler.getStore().getJob(id);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json({ job: { ...job, ...scheduler.getJobStatus(job.id) } });
});

// POST /api/schedules — create a new job
app.post("/api/schedules", (req: Request, res: Response) => {
  if (!scheduler) { res.status(503).json({ error: "Scheduler not enabled" }); return; }
  const body = req.body as Partial<ScheduleJob>;
  if (!body.name || !body.agentId || !body.cron || !body.instructionFile) {
    res.status(400).json({ error: "Missing required fields: name, agentId, cron, instructionFile" });
    return;
  }
  if (!agentMap.has(body.agentId)) {
    res.status(400).json({ error: `Unknown agent: ${body.agentId}` });
    return;
  }
  const now = new Date().toISOString();
  const job: ScheduleJob = {
    id: body.id ?? randomUUID(),
    name: body.name,
    agentId: body.agentId,
    cron: body.cron,
    instructionFile: body.instructionFile,
    enabled: body.enabled ?? true,
    timezone: body.timezone,
    description: body.description,
    createdAt: now,
    updatedAt: now,
  };
  scheduler.addJob(job);
  res.status(201).json({ job });
});

// PATCH /api/schedules/:id — update a job
app.patch("/api/schedules/:id", (req: Request, res: Response) => {
  if (!scheduler) { res.status(503).json({ error: "Scheduler not enabled" }); return; }
  const id = req.params.id as string;
  try {
    const updated = scheduler.updateJob(id, { ...req.body, updatedAt: new Date().toISOString() });
    res.json({ job: updated });
  } catch {
    res.status(404).json({ error: "Job not found" });
  }
});

// DELETE /api/schedules/:id — delete a job
app.delete("/api/schedules/:id", (req: Request, res: Response) => {
  if (!scheduler) { res.status(503).json({ error: "Scheduler not enabled" }); return; }
  scheduler.deleteJob(req.params.id as string);
  res.json({ status: "deleted" });
});

// POST /api/schedules/:id/trigger — manually trigger a job
app.post("/api/schedules/:id/trigger", (req: Request, res: Response) => {
  if (!scheduler) { res.status(503).json({ error: "Scheduler not enabled" }); return; }
  const id = req.params.id as string;
  try {
    scheduler.triggerJob(id);
    res.json({ status: "triggered", jobId: id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(404).json({ error: msg });
  }
});

// GET /api/schedules/:id/runs — list runs for a job
app.get("/api/schedules/:id/runs", (req: Request, res: Response) => {
  if (!scheduler) { res.status(503).json({ error: "Scheduler not enabled" }); return; }
  const id = req.params.id as string;
  const job = scheduler.getStore().getJob(id);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  const agent = agentMap.get(job.agentId);
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
  const limit = parseInt(req.query.limit as string) || 20;
  const runs = scheduler.getResultStore().listRuns(agent.workspace, job.id, limit);
  res.json({ runs });
});

// GET /api/schedules/:id/runs/:runId — get a single run result
app.get("/api/schedules/:id/runs/:runId", (req: Request, res: Response) => {
  if (!scheduler) { res.status(503).json({ error: "Scheduler not enabled" }); return; }
  const id = req.params.id as string;
  const runId = req.params.runId as string;
  const job = scheduler.getStore().getJob(id);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  const agent = agentMap.get(job.agentId);
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
  const run = scheduler.getResultStore().getRun(agent.workspace, job.id, runId);
  if (!run) { res.status(404).json({ error: "Run not found" }); return; }
  res.json({ run });
});

// POST /api/schedules/reload — reload all schedules from disk
app.post("/api/schedules/reload", (_req: Request, res: Response) => {
  if (!scheduler) { res.status(503).json({ error: "Scheduler not enabled" }); return; }
  scheduler.reload();
  res.json({ status: "reloaded" });
});

// GET /api/schedule-runs/recent — list recent completed runs across all agents
app.get("/api/schedule-runs/recent", (req: Request, res: Response) => {
  if (!scheduler) { res.status(503).json({ error: "Scheduler not enabled" }); return; }
  const since = req.query.since as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const runs = scheduler.listRecentRuns(since, limit);
  res.json({ runs });
});

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------

app.listen(config.port, config.host, () => {
  console.log(`omniclaw MCP server listening on http://${config.host}:${config.port}`);
  console.log(`  tools registered: ${toolMap.size}`);
  console.log(`  agents loaded: ${agentsFile.agents.length} (${agentsFile.agents.map((a) => a.id).join(", ")})`);
  if (scheduler) {
    console.log(`  scheduler: enabled (gateway: ${config.gatewayUrl})`);
  }
  console.log(`  health: http://${config.host}:${config.port}/health`);
});
