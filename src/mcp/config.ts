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
