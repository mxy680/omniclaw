import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerCollectionsListTool(manager: FramerClientManager): any {
  return {
    name: "framer_collections_list",
    label: "Framer List Collections",
    description: "List all CMS collections in the project.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const collections = await conn.getCollections();
        return jsonResult(collections.map((c) => ({ id: c.id, name: c.name, slugFieldName: c.slugFieldName, managedBy: c.managedBy })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerCollectionGetTool(manager: FramerClientManager): any {
  return {
    name: "framer_collection_get",
    label: "Framer Get Collection",
    description: "Get a CMS collection by its ID.",
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
        const collection = await conn.getCollection(params.collection_id);
        return jsonResult(collection);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerCollectionCreateTool(manager: FramerClientManager): any {
  return {
    name: "framer_collection_create",
    label: "Framer Create Collection",
    description: "Create a new CMS collection.",
    parameters: Type.Object({
      name: Type.String({ description: "Name for the new collection." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { name: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const collection = await conn.createCollection(params.name);
        return jsonResult(collection);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerCollectionCreateManagedTool(manager: FramerClientManager): any {
  return {
    name: "framer_collection_create_managed",
    label: "Framer Create Managed Collection",
    description: "Create a new plugin-managed CMS collection.",
    parameters: Type.Object({
      name: Type.String({ description: "Name for the new managed collection." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { name: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const collection = await conn.createManagedCollection(params.name);
        return jsonResult(collection);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
