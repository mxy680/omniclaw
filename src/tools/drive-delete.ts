import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("drive");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveDeleteTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_delete",
    label: "Drive Delete File",
    description:
      "Move a Google Drive file or folder to trash. By default the file is trashed (recoverable). Pass permanent=true to permanently delete it.",
    parameters: Type.Object({
      file_id: Type.String({ description: "ID of the file or folder to delete." }),
      permanent: Type.Optional(
        Type.Boolean({
          description:
            "If true, permanently delete the file instead of trashing it. Defaults to false.",
          default: false,
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
      params: { file_id: string; permanent?: boolean; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      if (params.permanent) {
        await drive.files.delete({ fileId: params.file_id });
      } else {
        await drive.files.update({
          fileId: params.file_id,
          requestBody: { trashed: true },
        });
      }

      return jsonResult({
        success: true,
        file_id: params.file_id,
        permanent: params.permanent ?? false,
      });
    },
  };
}
