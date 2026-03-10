import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerUploadImageTool(manager: FramerClientManager): any {
  return {
    name: "framer_upload_image",
    label: "Framer Upload Image",
    description: "Upload an image to the project asset library from a URL.",
    parameters: Type.Object({
      url: Type.String({ description: "The image URL to upload." }),
      name: Type.Optional(Type.String({ description: "Display name for the image." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { url: string; name?: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const asset = await conn.uploadImage({ image: params.url, name: params.name });
        return jsonResult(asset);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerUploadFileTool(manager: FramerClientManager): any {
  return {
    name: "framer_upload_file",
    label: "Framer Upload File",
    description: "Upload a file to the project asset library from a URL.",
    parameters: Type.Object({
      url: Type.String({ description: "The file URL to upload." }),
      name: Type.Optional(Type.String({ description: "Display name for the file." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { url: string; name?: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const asset = await conn.uploadFile({ file: params.url, name: params.name });
        return jsonResult(asset);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
