// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenClawPluginApi = any;
import type { PluginConfig } from "./types/plugin-config.js";
import { createAllTools } from "./mcp/tool-registry.js";

export function register(api: OpenClawPluginApi): void {
  const config = (api.pluginConfig ?? {}) as unknown as PluginConfig;

  const tools = createAllTools({ pluginConfig: config });
  for (const tool of tools) {
    api.registerTool(tool);
  }

  if (!config.client_secret_path) {
    api.logger.warn(
      "[omniclaw] client_secret_path is not configured. Google Workspace tools will not be available. " +
        "Set it via: openclaw plugins config omniclaw",
    );
  }
}
