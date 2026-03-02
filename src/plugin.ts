// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenClawPluginApi = any;
import type { PluginConfig } from "./types/plugin-config.js";
import { createAllTools } from "./mcp/tool-registry.js";
import { loadAgentConfigs, isToolAllowed } from "./mcp/agent-config.js";

export function register(api: OpenClawPluginApi): void {
  const config = (api.pluginConfig ?? {}) as unknown as PluginConfig;

  const tools = createAllTools({ pluginConfig: config });
  for (const tool of tools) {
    api.registerTool(tool);
  }

  // Per-agent tool permissions: block tool calls not allowed by the agent's config
  const agentsFile = loadAgentConfigs();
  const agentMap = new Map(agentsFile.agents.map((a) => [a.id, a]));

  if (agentMap.size > 0) {
    api.on(
      "before_tool_call",
      (_event: unknown, ctx: { agentId?: string; toolName: string }) => {
        if (!ctx.agentId) return;
        const agent = agentMap.get(ctx.agentId);
        if (!agent) return;
        if (!isToolAllowed(ctx.toolName, agent.permissions)) {
          return {
            block: true,
            blockReason: `Tool "${ctx.toolName}" not permitted for agent "${ctx.agentId}"`,
          };
        }
      },
    );
  }

  if (!config.client_secret_path) {
    api.logger.warn(
      "[omniclaw] client_secret_path is not configured. Google Workspace tools will not be available. " +
        "Set it via: openclaw plugins config omniclaw",
    );
  }
}
