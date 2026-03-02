import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface McpServerConfig {
  client_secret_path: string;
  tokens_path?: string;
  oauth_port?: number;
}

let cached: McpServerConfig | null = null;

export function getConfig(): McpServerConfig {
  if (cached) return cached;

  const configPath =
    process.env.OMNICLAW_MCP_CONFIG ??
    join(homedir(), ".openclaw", "mcp-server-config.json");

  if (!existsSync(configPath)) {
    throw new Error(
      `Config not found at ${configPath}. Set OMNICLAW_MCP_CONFIG or create ~/.openclaw/mcp-server-config.json`,
    );
  }

  cached = JSON.parse(readFileSync(configPath, "utf-8")) as McpServerConfig;
  return cached;
}

export function getTokensPath(): string {
  const config = getConfig();
  return config.tokens_path ?? join(homedir(), ".openclaw", "omniclaw-tokens.json");
}

export function getClientSecretPath(): string {
  return getConfig().client_secret_path;
}
