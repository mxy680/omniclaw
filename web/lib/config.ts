import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface McpServerConfig {
  client_secret_path: string;
  tokens_path?: string;
  oauth_port?: number;
  github_token?: string;
}

let cached: McpServerConfig | null = null;

function getConfigPath(): string {
  return (
    process.env.OMNICLAW_MCP_CONFIG ??
    join(homedir(), ".openclaw", "mcp-server-config.json")
  );
}

export function getConfig(): McpServerConfig {
  if (cached) return cached;

  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    throw new Error(
      `Config not found at ${configPath}. Set OMNICLAW_MCP_CONFIG or create ~/.openclaw/mcp-server-config.json`,
    );
  }

  cached = JSON.parse(readFileSync(configPath, "utf-8")) as McpServerConfig;
  return cached;
}

export function updateConfig(updates: Partial<McpServerConfig>): void {
  const configPath = getConfigPath();
  const config = getConfig();
  const updated = { ...config, ...updates };
  writeFileSync(configPath, JSON.stringify(updated, null, 2), "utf-8");
  cached = updated;
}

export function getTokensPath(): string {
  const config = getConfig();
  return config.tokens_path ?? join(homedir(), ".openclaw", "omniclaw-tokens.json");
}

export function getClientSecretPath(): string {
  return getConfig().client_secret_path;
}
