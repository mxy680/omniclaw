import { Type } from "@sinclair/typebox";
import type { GeminiClientManager } from "../auth/gemini-client-manager.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGeminiAuthSetupTool(manager: GeminiClientManager): any {
  return {
    name: "gemini_auth_setup",
    label: "Gemini Auth Setup",
    description:
      "Validate a Gemini API key and confirm access. Call this before using any other Gemini tool.",
    parameters: Type.Object({
      api_key: Type.String({
        description: "Gemini API key from Google AI Studio.",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { api_key: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.setApiKey(account, params.api_key);
      const ai = client.getClient();
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: "Reply with exactly: ok",
        });
        const text = response.text?.trim();
        return jsonResult({
          status: "authenticated",
          message: "Gemini API key is valid.",
          test_response: text,
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "auth_failed",
          message: err instanceof Error ? err.message : String(err),
          note: "The API key may be invalid. Get one at https://aistudio.google.com/apikey",
        });
      }
    },
  };
}
