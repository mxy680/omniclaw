import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("drive");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveListTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_list",
    label: "Drive List Files",
    description:
      "List files and folders in Google Drive. Optionally filter by parent folder. Returns id, name, mimeType, size, and modifiedTime for each item.",
    parameters: Type.Object({
      folder_id: Type.Optional(
        Type.String({
          description: "ID of the folder to list. Defaults to the Drive root.",
          default: "root",
        }),
      ),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of files to return. Defaults to 20.",
          default: 20,
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
      params: { folder_id?: string; max_results?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      const folderId = params.folder_id ?? "root";
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
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
