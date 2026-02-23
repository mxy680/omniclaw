import { Type } from "@sinclair/typebox";
import type { GeminiClientManager } from "../auth/gemini-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGeminiAuthTool(manager: GeminiClientManager, config: PluginConfig): any {
  return {
    name: "gemini_auth_setup",
    label: "Gemini Auth Setup",
    description:
      "Authenticate with Google Gemini using an API key. " +
      "The key is read from the plugin config (gemini_api_key) by default — just call with no arguments. " +
      "You can also pass a key directly. The tool validates the key by listing available models.",
    parameters: Type.Object({
      api_key: Type.Optional(
        Type.String({
          description: "Gemini API key. If omitted, reads from plugin config gemini_api_key.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'personal'). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { api_key?: string; account?: string }) {
      const account = params.account ?? "default";
      const apiKey = params.api_key ?? config.gemini_api_key;

      if (!apiKey) {
        return jsonResult({
          status: "error",
          error:
            "No Gemini API key provided. Either pass it as a tool argument or pre-configure via: " +
            'openclaw config set plugins.entries.omniclaw.config.gemini_api_key "your_key"',
        });
      }

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });
        const pager = await ai.models.list();

        manager.setKey(account, apiKey);

        const modelCount = pager.pageLength;
        return jsonResult({
          status: "authenticated",
          account,
          models_available: modelCount,
          message: `Gemini API key validated. ${modelCount} models available.`,
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
