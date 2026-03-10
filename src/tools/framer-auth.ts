import { Type } from "@sinclair/typebox";
import type { FramerClientManager } from "../auth/framer-client-manager.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFramerAuthSetupTool(manager: FramerClientManager): any {
  return {
    name: "framer_auth_setup",
    label: "Framer Auth Setup",
    description:
      "Connect to a Framer project using a project URL and API key. Each account represents one project. Call this before using any Framer Server API tool.",
    parameters: Type.Object({
      project_url: Type.String({
        description:
          "Framer project URL (e.g., https://framer.com/projects/Website--aabbccdd1122).",
      }),
      api_key: Type.String({
        description: "Framer API key from the project's site settings.",
      }),
      account: Type.Optional(
        Type.String({
          description: "Account name (project alias). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { project_url: string; api_key: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.setCredentials(
        account,
        params.project_url,
        params.api_key,
      );
      try {
        const conn = await client.getConnection();
        const info = await conn.getProjectInfo();
        return jsonResult({
          status: "connected",
          account,
          project: info,
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "auth_failed",
          message: err instanceof Error ? err.message : String(err),
          note: "The project URL or API key may be invalid.",
        });
      }
    },
  };
}
