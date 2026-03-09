import { resolve } from "node:path";
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

export async function getToolRegistry(): Promise<ToolRegistry> {
  if (cached) return cached;

  // Resolve absolute path to compiled tool registry
  // process.cwd() = web/, so go up one level to project root
  const registryPath = resolve(process.cwd(), "..", "dist", "mcp", "tool-registry.js");

  // Dynamic import with webpackIgnore comment to prevent bundling
  const mod = await import(/* webpackIgnore: true */ registryPath);
  const { createAllTools } = mod as {
    createAllTools: (opts: { pluginConfig: { client_secret_path: string; tokens_path?: string; oauth_port?: number } }) => OmniclawTool[];
  };

  const config = getConfig();
  const tools = createAllTools({ pluginConfig: config });

  // Build service map, filtering out auth_setup tools
  const services: Record<string, ServiceTools> = {};
  const toolMap = new Map<string, OmniclawTool>();

  for (const tool of tools) {
    if (tool.name.endsWith("_auth_setup")) continue;

    const serviceId = tool.name.split("_")[0];
    if (!SERVICE_NAMES[serviceId]) continue;

    toolMap.set(tool.name, tool);

    if (!services[serviceId]) {
      services[serviceId] = {
        name: SERVICE_NAMES[serviceId],
        tools: [],
      };
    }

    services[serviceId].tools.push({
      name: tool.name,
      label: tool.label,
      description: tool.description,
      parameters: tool.parameters,
    });
  }

  cached = {
    services,
    execute: async (toolName: string, params: Record<string, unknown>) => {
      const tool = toolMap.get(toolName);
      if (!tool) throw new Error(`Unknown tool: ${toolName}`);
      return tool.execute(`web-test-${Date.now()}`, params);
    },
  };

  return cached;
}
