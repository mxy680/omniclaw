import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerLocalesListTool(manager: FramerClientManager): any {
  return {
    name: "framer_locales_list",
    label: "Framer List Locales",
    description: "List all locales configured in the project, including the default locale.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const [locales, defaultLocale] = await Promise.all([conn.getLocales(), conn.getDefaultLocale()]);
        return jsonResult({ locales, defaultLocale });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerLocalizationGroupsTool(manager: FramerClientManager): any {
  return {
    name: "framer_localization_groups",
    label: "Framer Localization Groups",
    description: "Get all localization groups (pages, CMS items, etc.) with their translatable sources.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const groups = await conn.getLocalizationGroups();
        return jsonResult(groups);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerLocalizationUpdateTool(manager: FramerClientManager): any {
  return {
    name: "framer_localization_update",
    label: "Framer Update Localization",
    description: "Update localized values and/or group locale statuses.",
    parameters: Type.Object({
      update: Type.Record(Type.String(), Type.Unknown(), {
        description: 'Localization update with valuesBySource and/or statusByLocaleByGroup. E.g. { valuesBySource: { [sourceId]: { [localeId]: { action: "set", value: "Hello" } } } }.',
      }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { update: Record<string, unknown>; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await conn.setLocalizationData(params.update as any);
        return jsonResult(result);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
