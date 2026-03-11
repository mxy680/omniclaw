import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("framer");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerCodeFilesListTool(manager: FramerClientManager): any {
  return {
    name: "framer_code_files_list",
    label: "Framer List Code Files",
    description: "List all code files in the project.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const files = await conn.getCodeFiles();
        return jsonResult(files.map((f) => ({ id: f.id, name: f.name, path: f.path, exports: f.exports })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerCodeFileGetTool(manager: FramerClientManager): any {
  return {
    name: "framer_code_file_get",
    label: "Framer Get Code File",
    description: "Get a code file by its ID, including its content.",
    parameters: Type.Object({
      file_id: Type.String({ description: "The code file ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { file_id: string; account?: string }) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const conn = await client.getConnection();
        const file = await conn.getCodeFile(params.file_id);
        if (!file) return jsonResult({ error: "not_found", message: "Code file not found." });
        return jsonResult({ id: file.id, name: file.name, path: file.path, content: file.content, exports: file.exports });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

