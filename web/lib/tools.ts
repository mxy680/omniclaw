import { resolve } from "node:path";
import { existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { getConfig } from "./config";

interface ToolInfo {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
}

interface ServiceTools {
  name: string;
  tools: ToolInfo[];
}

interface ToolRegistry {
  services: Record<string, ServiceTools>;
  execute: (toolName: string, params: Record<string, unknown>) => Promise<unknown>;
}

interface OmniclawTool {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<unknown>;
}

const SERVICE_NAMES: Record<string, string> = {
  gmail: "Gmail",
  calendar: "Calendar",
  drive: "Drive",
  docs: "Docs",
  sheets: "Sheets",
  slides: "Slides",
  youtube: "YouTube",
  github: "GitHub",
  gemini: "Gemini",
  wolfram: "Wolfram Alpha",
  linkedin: "LinkedIn",
  instagram: "Instagram",
};

let cached: ToolRegistry | null = null;
let cachedMtime = 0;

function getRegistryPath() {
  const projectRoot = resolve(process.cwd(), "..");
  return resolve(projectRoot, "dist", "mcp", "tool-registry.js");
}

function ensureBuilt(registryPath: string) {
  if (existsSync(registryPath)) return;
  const projectRoot = resolve(process.cwd(), "..");
  try {
    execFileSync("npx", ["tsc"], { cwd: projectRoot, stdio: "pipe", timeout: 30_000 });
  } catch {
    // If build fails, fall through — the import below will throw a clearer error
  }
}

/**
 * Load tool metadata by spawning a fresh Node process.
 * This avoids Next.js / Node ESM module cache issues that cause stale tool lists
 * when `dist/` is rebuilt without restarting the dev server.
 */
function loadToolMetadata(registryPath: string): ToolInfo[] {
  const config = getConfig();
  const script = `
    import { createAllTools } from ${JSON.stringify("file://" + registryPath)};
    const tools = createAllTools({ pluginConfig: ${JSON.stringify(config)} });
    const out = tools.map(t => ({
      name: t.name,
      label: t.label,
      description: t.description,
      parameters: t.parameters,
    }));
    process.stdout.write(JSON.stringify(out));
  `;

  try {
    const result = execFileSync("node", ["--input-type=module", "-e", script], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });

    return JSON.parse(result.toString("utf-8"));
  } catch (err: unknown) {
    const execErr = err as { stderr?: Buffer; status?: number };
    const stderr = execErr.stderr?.toString?.() ?? "";
    console.error("[tools] Subprocess failed (exit", execErr.status + "):", stderr.slice(0, 500));
    throw new Error(`Tool registry subprocess failed: ${stderr.split("\n")[0] || "unknown error"}`);
  }
}

function buildServiceMap(tools: ToolInfo[]) {
  const services: Record<string, ServiceTools> = {};

  for (const tool of tools) {
    if (tool.name.endsWith("_auth_setup")) continue;

    const serviceId = tool.name.split("_")[0];
    if (!SERVICE_NAMES[serviceId]) continue;

    if (!services[serviceId]) {
      services[serviceId] = {
        name: SERVICE_NAMES[serviceId],
        tools: [],
      };
    }

    services[serviceId].tools.push(tool);
  }

  return services;
}

export async function getToolRegistry(): Promise<ToolRegistry> {
  const registryPath = getRegistryPath();
  ensureBuilt(registryPath);

  // Invalidate cache when dist has been rebuilt
  const mtime = existsSync(registryPath) ? statSync(registryPath).mtimeMs : 0;
  if (cached && mtime === cachedMtime) return cached;
  cached = null;

  // Load metadata via subprocess to avoid stale module cache
  const toolInfos = loadToolMetadata(registryPath);
  const services = buildServiceMap(toolInfos);

  // Lazy-load the actual module for execute() (only needed for test-service)
  let toolMap: Map<string, OmniclawTool> | null = null;
  async function getToolMap() {
    if (toolMap) return toolMap;
    const mod = await import(/* webpackIgnore: true */ registryPath);
    const config = getConfig();
    const tools: OmniclawTool[] = mod.createAllTools({ pluginConfig: config });
    toolMap = new Map(tools.map((t) => [t.name, t]));
    return toolMap;
  }

  cached = {
    services,
    execute: async (toolName: string, params: Record<string, unknown>) => {
      const map = await getToolMap();
      const tool = map.get(toolName);
      if (!tool) throw new Error(`Unknown tool: ${toolName}`);
      return tool.execute(`web-test-${Date.now()}`, params);
    },
  };
  cachedMtime = mtime;

  return cached;
}
