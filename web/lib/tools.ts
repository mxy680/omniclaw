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

const SERVICE_NAMES: Record<string, string> = {
  gmail: "Gmail",
  calendar: "Calendar",
  drive: "Drive",
  docs: "Docs",
  sheets: "Sheets",
  slides: "Slides",
  youtube: "YouTube",
};

let cached: ToolRegistry | null = null;

export async function getToolRegistry(): Promise<ToolRegistry> {
  if (cached) return cached;

  // Dynamic import of compiled tool registry (webpack external)
  const mod = await import("../../dist/mcp/tool-registry.js");
  const { createAllTools } = mod;

  const config = getConfig();
  const tools = createAllTools({ pluginConfig: config });

  // Build service map, filtering out auth_setup tools
  const services: Record<string, ServiceTools> = {};
  const toolMap = new Map<string, (typeof tools)[number]>();

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
