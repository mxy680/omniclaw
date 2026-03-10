import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerItemsListTool(manager: FramerClientManager): any {
  return {
    name: "framer_items_list",
    label: "Framer List Items",
    description: "List all items in a CMS collection.",
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
        const items = await coll.getItems();
        return jsonResult(items.map((i) => ({ id: i.id, slug: i.slug, draft: i.draft, fieldData: i.fieldData })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerItemCreateTool(manager: FramerClientManager): any {
  return {
    name: "framer_item_create",
    label: "Framer Add Items",
    description: "Add new items to a CMS collection or update existing ones if their IDs match.",
    parameters: Type.Object({
      collection_id: Type.String({ description: "The collection ID." }),
      items: Type.Array(Type.Record(Type.String(), Type.Unknown()), {
        description: 'Array of items, e.g. [{ slug: "my-post", fieldData: { [fieldId]: { type: "string", value: "Hello" } } }].',
      }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { collection_id: string; items: Record<string, unknown>[]; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const coll = await conn.getCollection(params.collection_id);
        if (!coll) return jsonResult({ error: "not_found", message: "Collection not found." });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await coll.addItems(params.items as any);
        return jsonResult({ success: true, count: params.items.length });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerItemUpdateTool(manager: FramerClientManager): any {
  return {
    name: "framer_item_update",
    label: "Framer Update Item",
    description: "Update a CMS collection item's attributes (slug, fieldData, draft).",
    parameters: Type.Object({
      collection_id: Type.String({ description: "The collection ID." }),
      item_id: Type.String({ description: "The item ID to update." }),
      update: Type.Record(Type.String(), Type.Unknown(), {
        description: 'Update object, e.g. { slug: "new-slug", fieldData: { [fieldId]: { type: "number", value: 42 } } }.',
      }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { collection_id: string; item_id: string; update: Record<string, unknown>; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const coll = await conn.getCollection(params.collection_id);
        if (!coll) return jsonResult({ error: "not_found", message: "Collection not found." });
        const items = await coll.getItems();
        const item = items.find((i) => i.id === params.item_id);
        if (!item) return jsonResult({ error: "not_found", message: "Item not found." });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updated = await item.setAttributes(params.update as any);
        return jsonResult(updated);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerItemRemoveTool(manager: FramerClientManager): any {
  return {
    name: "framer_item_remove",
    label: "Framer Remove Items",
    description: "Remove items from a CMS collection by their IDs.",
    parameters: Type.Object({
      collection_id: Type.String({ description: "The collection ID." }),
      item_ids: Type.Array(Type.String(), { description: "Array of item IDs to remove." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { collection_id: string; item_ids: string[]; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const coll = await conn.getCollection(params.collection_id);
        if (!coll) return jsonResult({ error: "not_found", message: "Collection not found." });
        await coll.removeItems(params.item_ids);
        return jsonResult({ success: true, removed: params.item_ids.length });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerItemSetOrderTool(manager: FramerClientManager): any {
  return {
    name: "framer_item_set_order",
    label: "Framer Set Item Order",
    description: "Reorder items in a CMS collection.",
    parameters: Type.Object({
      collection_id: Type.String({ description: "The collection ID." }),
      item_ids: Type.Array(Type.String(), { description: "Array of item IDs in the desired order." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { collection_id: string; item_ids: string[]; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const coll = await conn.getCollection(params.collection_id);
        if (!coll) return jsonResult({ error: "not_found", message: "Collection not found." });
        await coll.setItemOrder(params.item_ids);
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
