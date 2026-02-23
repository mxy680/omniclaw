import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call drive_auth_setup to authenticate.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveSearchTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_search",
    label: "Drive Search Files",
    description:
      "Search for files in Google Drive using a query string. Supports Drive query syntax: name contains 'report', mimeType='application/pdf', fullText contains 'budget'. Returns id, name, mimeType, size, modifiedTime.",
    parameters: Type.Object({
      query: Type.String({
        description:
          "Drive search query. Examples: \"name contains 'report'\", \"mimeType='application/pdf'\", \"fullText contains 'Q4 budget'\".",
      }),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of results to return. Defaults to 20.",
          default: 20,
        })
      ),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; max_results?: number; account?: string }
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      const q = `(${params.query}) and trashed=false`;
      const res = await drive.files.list({
        q,
        pageSize: params.max_results ?? 20,
        fields: "files(id,name,mimeType,size,modifiedTime,parents)",
        orderBy: "modifiedTime desc",
      });

      const files = (res.data.files ?? []).map((f) => ({
        id: f.id ?? "",
        name: f.name ?? "",
        mimeType: f.mimeType ?? "",
        size: f.size ? parseInt(f.size) : null,
        modifiedTime: f.modifiedTime ?? "",
      }));

      return jsonResult(files);
    },
  };
}
