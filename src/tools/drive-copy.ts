import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("drive");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveCopyTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_copy",
    label: "Drive Copy File",
    description:
      "Copy a file in Google Drive. Optionally give the copy a new name and place it in a different folder.",
    parameters: Type.Object({
      file_id: Type.String({ description: "ID of the file to copy." }),
      name: Type.Optional(
        Type.String({ description: "Name for the copied file. Defaults to 'Copy of <original>'." }),
      ),
      parent_id: Type.Optional(
        Type.String({
          description: "ID of the destination folder. Defaults to the same folder as the original.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { file_id: string; name?: string; parent_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      const requestBody: { name?: string; parents?: string[] } = {};
      if (params.name) {
        requestBody.name = params.name;
      }
      if (params.parent_id) {
        requestBody.parents = [params.parent_id];
      }

      const res = await drive.files.copy({
        fileId: params.file_id,
        supportsAllDrives: true,
        requestBody,
        fields: "id,name,mimeType,webViewLink",
      });

      return jsonResult({
        success: true,
        id: res.data.id ?? "",
        name: res.data.name ?? "",
        mimeType: res.data.mimeType ?? "",
        webViewLink: res.data.webViewLink ?? "",
      });
    },
  };
}
