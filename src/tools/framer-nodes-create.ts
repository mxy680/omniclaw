import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeCreateFrameTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_create_frame",
    label: "Framer Create Frame",
    description: "Create a new frame node on the canvas. Frames are the primary container element in Framer.",
    parameters: Type.Object({
      attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Frame attributes (e.g. name, width, height, backgroundColor, borderRadius)." })),
      parent_id: Type.Optional(Type.String({ description: "Parent node ID. If omitted, added to the canvas root." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { attributes?: Record<string, unknown>; parent_id?: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = await conn.createFrameNode(params.attributes as any ?? {}, params.parent_id);
        return jsonResult(node);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeAddTextTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_add_text",
    label: "Framer Add Text",
    description: "Add a new text node to the canvas.",
    parameters: Type.Object({
      text: Type.String({ description: "The text content." }),
      tag: Type.Optional(Type.Union([
        Type.Literal("h1"), Type.Literal("h2"), Type.Literal("h3"),
        Type.Literal("h4"), Type.Literal("h5"), Type.Literal("h6"),
        Type.Literal("p"),
      ], { description: "HTML tag for the text. Defaults to 'p'." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { text: string; tag?: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await conn.addText(params.text, params.tag ? { tag: params.tag as any } : undefined);
        return jsonResult({ success: true, text: params.text });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeAddImageTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_add_image",
    label: "Framer Add Image",
    description: "Add an image to the canvas from a URL.",
    parameters: Type.Object({
      url: Type.String({ description: "The image URL." }),
      name: Type.Optional(Type.String({ description: "Display name for the image." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { url: string; name?: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        await conn.addImage({ image: params.url, name: params.name });
        return jsonResult({ success: true, url: params.url });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeAddSvgTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_add_svg",
    label: "Framer Add SVG",
    description: "Add an SVG element to the canvas from raw SVG markup.",
    parameters: Type.Object({
      svg: Type.String({ description: "Raw SVG markup." }),
      name: Type.Optional(Type.String({ description: "Display name for the SVG." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { svg: string; name?: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        await conn.addSVG({ svg: params.svg, name: params.name });
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerNodeAddComponentTool(manager: FramerClientManager): any {
  return {
    name: "framer_node_add_component",
    label: "Framer Add Component",
    description: "Add a component instance to the canvas by its module URL.",
    parameters: Type.Object({
      url: Type.String({ description: "Component module URL. Can be copied from the components panel in Framer." }),
      attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Optional component attributes." })),
      parent_id: Type.Optional(Type.String({ description: "Parent node ID." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { url: string; attributes?: Record<string, unknown>; parent_id?: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const node = await conn.addComponentInstance({
          url: params.url,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          attributes: params.attributes as any,
          parentId: params.parent_id,
        });
        return jsonResult(node);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
