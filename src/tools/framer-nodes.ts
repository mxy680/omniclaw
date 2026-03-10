import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeGetTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_get",
    label: "Framer Get Node",
    description: "Get a canvas node by its ID, including all its attributes.",
    parameters: Type.Object({
      node_id: Type.String({ description: "The ID of the node to retrieve." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { node_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const node = await conn.getNode(params.node_id);
        return jsonResult(node);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeChildrenTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_children",
    label: "Framer Get Children",
    description: "Get the children of a canvas node.",
    parameters: Type.Object({
      node_id: Type.String({ description: "The ID of the parent node." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { node_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const children = await conn.getChildren(params.node_id);
        return jsonResult(children);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeParentTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_parent",
    label: "Framer Get Parent",
    description: "Get the parent of a canvas node.",
    parameters: Type.Object({
      node_id: Type.String({ description: "The ID of the child node." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { node_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const parent = await conn.getParent(params.node_id);
        return jsonResult(parent);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodesByTypeTool(manager: FramerClientManager): any {
  return {
    name: "framer_nodes_by_type",
    label: "Framer Get Nodes by Type",
    description: "Get all canvas nodes of a specific type.",
    parameters: Type.Object({
      type: Type.Union([
        Type.Literal("FrameNode"),
        Type.Literal("TextNode"),
        Type.Literal("SVGNode"),
        Type.Literal("ComponentInstanceNode"),
        Type.Literal("WebPageNode"),
        Type.Literal("DesignPageNode"),
        Type.Literal("ComponentNode"),
      ], { description: "The node type to filter by." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { type: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodes = await conn.getNodesWithType(params.type as any);
        return jsonResult(nodes);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodesByAttributeTool(manager: FramerClientManager): any {
  return {
    name: "framer_nodes_by_attribute",
    label: "Framer Get Nodes by Attribute",
    description: "Get all canvas nodes that have a specific attribute.",
    parameters: Type.Object({
      attribute: Type.String({ description: "The attribute name to filter by (e.g. 'name', 'backgroundColor', 'opacity')." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { attribute: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodes = await conn.getNodesWithAttribute(params.attribute as any);
        return jsonResult(nodes);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
