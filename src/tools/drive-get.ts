import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("drive");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveGetTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_get",
    label: "Drive Get File",
    description:
      "Fetch full metadata for a single Google Drive file by its ID. Returns name, mimeType, size, modifiedTime, parents, webViewLink, and owners.",
    parameters: Type.Object({
      file_id: Type.String({ description: "The Google Drive file ID." }),
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

      const res = await drive.files.get({
        fileId: params.file_id,
        fields:
          "id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink,webContentLink,owners,shared,trashed,description",
      });

      const f = res.data;
      return jsonResult({
        id: f.id ?? "",
        name: f.name ?? "",
        mimeType: f.mimeType ?? "",
        size: f.size ? parseInt(f.size) : null,
        createdTime: f.createdTime ?? "",
        modifiedTime: f.modifiedTime ?? "",
        parents: f.parents ?? [],
        webViewLink: f.webViewLink ?? "",
        webContentLink: f.webContentLink ?? "",
        owners: (f.owners ?? []).map((o) => ({
          email: o.emailAddress ?? "",
          name: o.displayName ?? "",
        })),
        shared: f.shared ?? false,
        trashed: f.trashed ?? false,
        description: f.description ?? "",
      });
    },
  };
}
