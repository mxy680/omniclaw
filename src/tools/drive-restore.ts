import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("drive");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveRestoreTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_restore",
    label: "Drive Restore File",
    description: "Restore a trashed Google Drive file or folder back to its original location.",
    parameters: Type.Object({
      file_id: Type.String({ description: "ID of the trashed file or folder to restore." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { file_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      const res = await drive.files.update({
        fileId: params.file_id,
        supportsAllDrives: true,
        requestBody: { trashed: false },
        fields: "id,name,trashed",
      });

      return jsonResult({
        success: true,
        id: res.data.id ?? "",
        name: res.data.name ?? "",
        trashed: false,
      });
    },
  };
}
