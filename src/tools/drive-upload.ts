import { createReadStream } from "fs";
import { Readable } from "stream";
import { basename, extname } from "path";
import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { extToMime } from "./media-utils.js";

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
      "Create a new file or update an existing file in Google Drive. Accepts either a local file path (file_path) or inline text content (content). To update an existing file, provide its file_id. To create a new file, provide a name and optional parent folder.",
    parameters: Type.Object({
      name: Type.Optional(
        Type.String({
          description:
            "Name for the file (e.g. 'report.txt'). Defaults to the basename of file_path when file_path is provided.",
        }),
      ),
      content: Type.Optional(
        Type.String({
          description: "Text content to write to the file. Required if file_path is not provided.",
        }),
      ),
      file_path: Type.Optional(
        Type.String({
          description:
            "Path to a local file to upload. When provided, the file content is read from disk instead of from the 'content' parameter.",
        }),
      ),
      file_id: Type.Optional(
        Type.String({
          description: "ID of an existing file to update. If omitted, a new file is created.",
        }),
      ),
      mime_type: Type.Optional(
        Type.String({
          description:
            "MIME type of the file. Defaults to 'text/plain' for text content, or auto-detected from the file extension when file_path is provided.",
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
        name?: string;
        content?: string;
        file_path?: string;
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

      // Validate: need either file_path or content
      if (!params.file_path && !params.content) {
        return jsonResult({
          error: "missing_content",
          message: "Provide either 'file_path' (path to a local file) or 'content' (inline text).",
        });
      }

      const client = clientManager.getClient(account);
      const drive = google.drive({ version: "v3", auth: client });

      let mimeType: string;
      let body: Readable;
      let fileName: string;

      if (params.file_path) {
        // Binary/file upload path: stream from disk, auto-detect MIME from extension
        const ext = extname(params.file_path);
        mimeType = params.mime_type ?? extToMime(ext);
        body = createReadStream(params.file_path);
        fileName = params.name ?? basename(params.file_path);
      } else {
        // Text content path: keep existing behaviour
        mimeType = params.mime_type ?? "text/plain";
        body = Readable.from([params.content as string]);
        // name is required when using content — validated implicitly by Drive API if missing,
        // but provide a sensible fallback so callers are not surprised.
        fileName = params.name ?? "untitled.txt";
      }

      let res;
      if (params.file_id) {
        // Update existing file
        res = await drive.files.update({
          fileId: params.file_id,
          requestBody: { name: fileName },
          media: { mimeType, body },
          fields: "id,name,webViewLink",
        });
      } else {
        // Create new file
        const requestBody: { name: string; mimeType: string; parents?: string[] } = {
          name: fileName,
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
