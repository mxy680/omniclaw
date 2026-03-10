import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// --- Color Styles ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerColorStylesListTool(manager: FramerClientManager): any {
  return {
    name: "framer_color_styles_list",
    label: "Framer List Color Styles",
    description: "List all color styles in the project.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const styles = await conn.getColorStyles();
        return jsonResult(styles);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerColorStyleCreateTool(manager: FramerClientManager): any {
  return {
    name: "framer_color_style_create",
    label: "Framer Create Color Style",
    description: "Create a new color style in the project.",
    parameters: Type.Object({
      attributes: Type.Record(Type.String(), Type.Unknown(), { description: "Color style attributes (e.g. { name, light, dark })." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { attributes: Record<string, unknown>; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const style = await conn.createColorStyle(params.attributes as any);
        return jsonResult(style);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerColorStyleUpdateTool(manager: FramerClientManager): any {
  return {
    name: "framer_color_style_update",
    label: "Framer Update Color Style",
    description: "Update an existing color style's attributes.",
    parameters: Type.Object({
      style_id: Type.String({ description: "The color style ID." }),
      attributes: Type.Record(Type.String(), Type.Unknown(), { description: "Attributes to update." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { style_id: string; attributes: Record<string, unknown>; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const style = await conn.getColorStyle(params.style_id);
        if (!style) return jsonResult({ error: "not_found", message: "Color style not found." });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updated = await style.setAttributes(params.attributes as any);
        return jsonResult(updated);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerColorStyleRemoveTool(manager: FramerClientManager): any {
  return {
    name: "framer_color_style_remove",
    label: "Framer Remove Color Style",
    description: "Remove a color style from the project.",
    parameters: Type.Object({
      style_id: Type.String({ description: "The color style ID to remove." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { style_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const style = await conn.getColorStyle(params.style_id);
        if (!style) return jsonResult({ error: "not_found", message: "Color style not found." });
        await style.remove();
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// --- Text Styles ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerTextStylesListTool(manager: FramerClientManager): any {
  return {
    name: "framer_text_styles_list",
    label: "Framer List Text Styles",
    description: "List all text styles in the project.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const styles = await conn.getTextStyles();
        return jsonResult(styles);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerTextStyleCreateTool(manager: FramerClientManager): any {
  return {
    name: "framer_text_style_create",
    label: "Framer Create Text Style",
    description: "Create a new text style in the project.",
    parameters: Type.Object({
      attributes: Type.Record(Type.String(), Type.Unknown(), { description: "Text style attributes (e.g. { name, font, fontSize, lineHeight })." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { attributes: Record<string, unknown>; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const style = await conn.createTextStyle(params.attributes as any);
        return jsonResult(style);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerTextStyleUpdateTool(manager: FramerClientManager): any {
  return {
    name: "framer_text_style_update",
    label: "Framer Update Text Style",
    description: "Update an existing text style's attributes.",
    parameters: Type.Object({
      style_id: Type.String({ description: "The text style ID." }),
      attributes: Type.Record(Type.String(), Type.Unknown(), { description: "Attributes to update." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { style_id: string; attributes: Record<string, unknown>; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const style = await conn.getTextStyle(params.style_id);
        if (!style) return jsonResult({ error: "not_found", message: "Text style not found." });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updated = await style.setAttributes(params.attributes as any);
        return jsonResult(updated);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerTextStyleRemoveTool(manager: FramerClientManager): any {
  return {
    name: "framer_text_style_remove",
    label: "Framer Remove Text Style",
    description: "Remove a text style from the project.",
    parameters: Type.Object({
      style_id: Type.String({ description: "The text style ID to remove." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { style_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const style = await conn.getTextStyle(params.style_id);
        if (!style) return jsonResult({ error: "not_found", message: "Text style not found." });
        await style.remove();
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
