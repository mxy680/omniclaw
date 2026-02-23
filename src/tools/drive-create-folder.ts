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
export function createDriveCreateFolderTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_create_folder",
    label: "Drive Create Folder",
    description:
      "Create a new folder in Google Drive. Optionally place it inside a parent folder.",
    parameters: Type.Object({
      name: Type.String({ description: "Name of the new folder." }),
      parent_id: Type.Optional(
        Type.String({ description: "ID of the parent folder. Defaults to the Drive root." })
      ),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { name: string; parent_id?: string; account?: string }
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      const requestBody: {
        name: string;
        mimeType: string;
        parents?: string[];
      } = {
        name: params.name,
        mimeType: "application/vnd.google-apps.folder",
      };

      if (params.parent_id) {
        requestBody.parents = [params.parent_id];
      }

      const res = await drive.files.create({
        requestBody,
        fields: "id,name,webViewLink",
      });

      return jsonResult({
        success: true,
        id: res.data.id ?? "",
        name: res.data.name ?? "",
        webViewLink: res.data.webViewLink ?? "",
      });
    },
  };
}
