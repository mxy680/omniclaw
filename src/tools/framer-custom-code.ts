import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerCustomCodeGetTool(manager: FramerClientManager): any {
  return {
    name: "framer_custom_code_get",
    label: "Framer Get Custom Code",
    description: "Get custom code snippets installed in the project (head/body start/end).",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const code = await conn.getCustomCode();
        return jsonResult(code);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerCustomCodeSetTool(manager: FramerClientManager): any {
  return {
    name: "framer_custom_code_set",
    label: "Framer Set Custom Code",
    description: "Install or clear a custom code snippet (script/HTML) at a specific location in the page.",
    parameters: Type.Object({
      html: Type.Union([Type.String(), Type.Null()], { description: "The HTML/script code to install, or null to clear." }),
      location: Type.Union([
        Type.Literal("bodyStart"),
        Type.Literal("bodyEnd"),
        Type.Literal("headStart"),
        Type.Literal("headEnd"),
      ], { description: "Where to inject the code." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { html: string | null; location: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await conn.setCustomCode({ html: params.html, location: params.location as any });
        return jsonResult({ success: true, location: params.location });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
