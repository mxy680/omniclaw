import { Readable } from "stream";
import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";

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
export function createDriveUploadTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_upload",
    label: "Drive Upload File",
    description:
      "Create a new file or update an existing file in Google Drive with the given text content. To update an existing file, provide its file_id. To create a new file, provide a name and optional parent folder.",
    parameters: Type.Object({
      name: Type.String({ description: "Name for the file (e.g. 'report.txt')." }),
      content: Type.String({ description: "Text content to write to the file." }),
      file_id: Type.Optional(
        Type.String({
          description: "ID of an existing file to update. If omitted, a new file is created.",
        }),
      ),
      mime_type: Type.Optional(
        Type.String({
          description: "MIME type of the file. Defaults to 'text/plain'.",
          default: "text/plain",
        }),
      ),
      parent_id: Type.Optional(
        Type.String({ description: "ID of the parent folder. Defaults to the Drive root." }),
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
      params: {
        name: string;
        content: string;
        file_id?: string;
        mime_type?: string;
        parent_id?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      const mimeType = params.mime_type ?? "text/plain";
      const body = Readable.from([params.content]);

      let res;
      if (params.file_id) {
        // Update existing file
        res = await drive.files.update({
          fileId: params.file_id,
          requestBody: { name: params.name },
          media: { mimeType, body },
          fields: "id,name,webViewLink",
        });
      } else {
        // Create new file
        const requestBody: { name: string; mimeType: string; parents?: string[] } = {
          name: params.name,
          mimeType,
        };
        if (params.parent_id) {
          requestBody.parents = [params.parent_id];
        }

        res = await drive.files.create({
          requestBody,
          media: { mimeType, body },
          fields: "id,name,webViewLink",
        });
      }

      return jsonResult({
        success: true,
        id: res.data.id ?? "",
        name: res.data.name ?? "",
        webViewLink: res.data.webViewLink ?? "",
      });
    },
  };
}
