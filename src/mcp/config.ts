import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { PluginConfig } from "../types/plugin-config.js";

export interface McpServerConfig {
  port: number;
  host: string;
  authToken: string;
  plugin: PluginConfig;
  agentsPath: string;
  gatewayUrl: string;
  gatewayToken: string;
  schedulesPath: string;
  schedulerEnabled: boolean;
}

export function loadMcpConfig(): McpServerConfig {
  const authToken = process.env.OMNICLAW_MCP_TOKEN ?? "";

  const port = parseInt(process.env.OMNICLAW_MCP_PORT ?? "9850", 10);
  const host = process.env.OMNICLAW_MCP_HOST ?? "0.0.0.0";

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

  const agentsPath =
    process.env.OMNICLAW_AGENTS_PATH ??
    path.join(os.homedir(), ".openclaw", "agents.json");

  const gatewayUrl = process.env.OMNICLAW_GATEWAY_URL ?? "ws://localhost:18789";
  const gatewayToken = process.env.OMNICLAW_GATEWAY_TOKEN ?? authToken;
  const schedulesPath =
    process.env.OMNICLAW_SCHEDULES_PATH ??
    path.join(os.homedir(), ".openclaw", "schedules.json");
  const schedulerEnabled = process.env.OMNICLAW_SCHEDULER_ENABLED !== "false";

  return { port, host, authToken, plugin, agentsPath, gatewayUrl, gatewayToken, schedulesPath, schedulerEnabled };
}
