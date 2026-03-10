import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerPageCreateWebTool(manager: FramerClientManager): any {
  return {
    name: "framer_page_create_web",
    label: "Framer Create Web Page",
    description: "Create a new web page in the Framer project.",
    parameters: Type.Object({
      path: Type.String({ description: "The URL path for the new web page (e.g. '/about')." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { path: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const page = await conn.createWebPage(params.path);
        return jsonResult(page);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerPageCreateDesignTool(manager: FramerClientManager): any {
  return {
    name: "framer_page_create_design",
    label: "Framer Create Design Page",
    description: "Create a new design page in the Framer project.",
    parameters: Type.Object({
      name: Type.String({ description: "The name for the new design page." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { name: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const page = await conn.createDesignPage(params.name);
        return jsonResult(page);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
