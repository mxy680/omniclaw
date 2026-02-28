// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenClawPluginApi = any;
import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { iosChannelPlugin, getDispatchManager } from "./channel/channel-plugin.js";
import { setChannelRuntime } from "./channel/runtime.js";
import { getWsServer } from "./channel/send.js";
import { getActiveContext } from "./channel/active-context.js";
import { createBackgroundWorkerTool } from "./tools/background-worker.js";
import type { PluginConfig } from "./types/plugin-config.js";
import { createAllTools } from "./mcp/tool-registry.js";

export { getActiveNutritionDb as getNutritionDb } from "./mcp/tool-registry.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function truncateStr(val: unknown, max = 200): string {
  const s = typeof val === "string" ? val : JSON.stringify(val);
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function wrapToolWithBroadcast(tool: any): any {
  const originalExecute = tool.execute;
  return {
    ...tool,
    execute: async (...args: unknown[]) => {
      const ws = getWsServer();
      const ctx = getActiveContext();
      const params = (args[1] ?? {}) as Record<string, unknown>;
      const startTs = Date.now();
      if (ws && ctx.conversationId) {
        ws.broadcast({
          type: "tool_use",
          name: tool.name,
          phase: "start",
          conversationId: ctx.conversationId,
          params,
        });
      }
      let rawResult: unknown;
      try {
        rawResult = await originalExecute(...args);
        return rawResult;
      } finally {
        if (ws && ctx.conversationId) {
          ws.broadcast({
            type: "tool_use",
            name: tool.name,
            phase: "end",
            conversationId: ctx.conversationId,
            durationMs: Date.now() - startTs,
            result: truncateStr(rawResult),
          });
        }
      }
    },
  };
}

export function register(api: OpenClawPluginApi): void {
  // iOS WebSocket channel
  setChannelRuntime(api.runtime);
  api.registerChannel({ plugin: iosChannelPlugin as ChannelPlugin });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = (tool: any) =>
    api.registerTool(wrapToolWithBroadcast(tool));

  const config = (api.pluginConfig ?? {}) as unknown as PluginConfig;

  const tools = createAllTools({ pluginConfig: config });
  for (const tool of tools) {
    reg(tool);
  }

  reg(createBackgroundWorkerTool({
    submitBackground: async (req) => {
      const manager = getDispatchManager();
      if (!manager) {
        throw new Error("Dispatch manager not initialized — iOS channel not running");
      }
      const ctx = getActiveContext();
      const conversationId = req.reportToConversation ?? ctx.conversationId;
      if (!conversationId) {
        throw new Error("No conversation context — cannot determine where to report results");
      }
      const taskId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Submit as background priority — will run when a slot opens
      manager.submit({
        conversationId: taskId,
        connId: ctx.connId ?? "",
        priority: "background",
        fn: async () => {
          // TODO: In a future task, this will dispatch the background
          // task text through the agent. For now, this is a placeholder
          // that establishes the plumbing.
        },
      }).catch((err) => {
        // Background tasks fail silently — errors logged but don't crash
        api.logger.error(`[omniclaw] background task ${taskId} failed: ${err}`);
      });

      return taskId;
    },
  }));

  if (!config.client_secret_path) {
    api.logger.warn(
      "[omniclaw] client_secret_path is not configured. Gmail tools will not be available. " +
        "Set it via: openclaw plugins config omniclaw",
    );
  }
}
