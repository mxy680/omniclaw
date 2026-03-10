import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeSetAttributesTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_set_attributes",
    label: "Framer Set Node Attributes",
    description: "Update attributes on a canvas node (e.g. name, width, height, backgroundColor, opacity, rotation).",
    parameters: Type.Object({
      node_id: Type.String({ description: "The ID of the node to update." }),
      attributes: Type.Record(Type.String(), Type.Unknown(), { description: "Attributes to set on the node." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { node_id: string; attributes: Record<string, unknown>; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = await conn.setAttributes(params.node_id, params.attributes as any);
        return jsonResult(node);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeSetParentTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_set_parent",
    label: "Framer Set Node Parent",
    description: "Move a node to a new parent, optionally at a specific index.",
    parameters: Type.Object({
      node_id: Type.String({ description: "The ID of the node to move." }),
      parent_id: Type.String({ description: "The ID of the new parent node." }),
      index: Type.Optional(Type.Number({ description: "Position within the parent's children. If omitted, appended at the end." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { node_id: string; parent_id: string; index?: number; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        await conn.setParent(params.node_id, params.parent_id, params.index);
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeCloneTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_clone",
    label: "Framer Clone Node",
    description: "Clone (duplicate) a canvas node.",
    parameters: Type.Object({
      node_id: Type.String({ description: "The ID of the node to clone." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { node_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const cloned = await conn.cloneNode(params.node_id);
        return jsonResult(cloned);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeRemoveTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_remove",
    label: "Framer Remove Nodes",
    description: "Remove one or more nodes from the canvas.",
    parameters: Type.Object({
      node_ids: Type.Array(Type.String(), { description: "Array of node IDs to remove." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { node_ids: string[]; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        await conn.removeNodes(params.node_ids);
        return jsonResult({ success: true, removed: params.node_ids.length });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
