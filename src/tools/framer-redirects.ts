import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerRedirectsListTool(manager: FramerClientManager): any {
  return {
    name: "framer_redirects_list",
    label: "Framer List Redirects",
    description: "List all URL redirects configured in the project.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const redirects = await conn.getRedirects();
        return jsonResult(redirects);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerRedirectAddTool(manager: FramerClientManager): any {
  return {
    name: "framer_redirect_add",
    label: "Framer Add Redirects",
    description: "Add new URL redirects or update existing ones. Supports wildcards in paths.",
    parameters: Type.Object({
      redirects: Type.Array(
        Type.Object({
          from: Type.String({ description: "Source path (e.g. '/old-page'). Supports wildcards (*)." }),
          to: Type.String({ description: "Destination path (e.g. '/new-page'). Can reference captured groups with :1, :2." }),
          expandToAllLocales: Type.Optional(Type.Boolean({ description: "Whether to expand the redirect to all locales." })),
        }),
        { description: "Array of redirects to add." },
      ),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { redirects: Array<{ from: string; to: string; expandToAllLocales?: boolean }>; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const added = await conn.addRedirects(params.redirects as any);
        return jsonResult(added);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerRedirectRemoveTool(manager: FramerClientManager): any {
  return {
    name: "framer_redirect_remove",
    label: "Framer Remove Redirects",
    description: "Remove URL redirects by their IDs.",
    parameters: Type.Object({
      redirect_ids: Type.Array(Type.String(), { description: "Array of redirect IDs to remove." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { redirect_ids: string[]; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        await conn.removeRedirects(params.redirect_ids);
        return jsonResult({ success: true, removed: params.redirect_ids.length });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
