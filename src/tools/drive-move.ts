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
export function createDriveMoveTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_move",
    label: "Drive Move File",
    description:
      "Move a Google Drive file or folder to a different parent folder.",
    parameters: Type.Object({
      file_id: Type.String({ description: "ID of the file or folder to move." }),
      folder_id: Type.String({ description: "ID of the destination folder." }),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { file_id: string; folder_id: string; account?: string }
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      // Get current parents to remove them
      const meta = await drive.files.get({
        fileId: params.file_id,
        fields: "parents",
      });

      const previousParents = (meta.data.parents ?? []).join(",");

      const res = await drive.files.update({
        fileId: params.file_id,
        addParents: params.folder_id,
        removeParents: previousParents,
        fields: "id,name,parents",
      });

      return jsonResult({
        success: true,
        id: res.data.id ?? "",
        name: res.data.name ?? "",
        parents: res.data.parents ?? [],
      });
    },
  };
}
