import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerFieldsListTool(manager: FramerClientManager): any {
  return {
    name: "framer_fields_list",
    label: "Framer List Fields",
    description: "List all fields in a CMS collection.",
    parameters: Type.Object({
      collection_id: Type.String({ description: "The collection ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { collection_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const coll = await conn.getCollection(params.collection_id);
        if (!coll) return jsonResult({ error: "not_found", message: "Collection not found." });
        const fields = await coll.getFields();
        return jsonResult(fields);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerFieldAddTool(manager: FramerClientManager): any {
  return {
    name: "framer_field_add",
    label: "Framer Add Fields",
    description: "Add new fields to a CMS collection. Each field needs at minimum a type and name.",
    parameters: Type.Object({
      collection_id: Type.String({ description: "The collection ID." }),
      fields: Type.Array(Type.Record(Type.String(), Type.Unknown()), {
        description: 'Array of field definitions, e.g. [{ type: "string", name: "Title" }, { type: "number", name: "Price" }].',
      }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { collection_id: string; fields: Record<string, unknown>[]; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const coll = await conn.getCollection(params.collection_id);
        if (!coll) return jsonResult({ error: "not_found", message: "Collection not found." });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const created = await coll.addFields(params.fields as any);
        return jsonResult(created);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerFieldRemoveTool(manager: FramerClientManager): any {
  return {
    name: "framer_field_remove",
    label: "Framer Remove Fields",
    description: "Remove fields from a CMS collection by their IDs.",
    parameters: Type.Object({
      collection_id: Type.String({ description: "The collection ID." }),
      field_ids: Type.Array(Type.String(), { description: "Array of field IDs to remove." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { collection_id: string; field_ids: string[]; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const coll = await conn.getCollection(params.collection_id);
        if (!coll) return jsonResult({ error: "not_found", message: "Collection not found." });
        await coll.removeFields(params.field_ids);
        return jsonResult({ success: true, removed: params.field_ids.length });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
