import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("drive");

// Google Workspace MIME types and their plain-text export formats
const EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveReadTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_read",
    label: "Drive Read File",
    description:
      "Read the text content of a Google Drive file. Works with Google Docs (exported as plain text), Google Sheets (exported as CSV), Google Slides (exported as plain text), and plain-text files. Binary files (images, PDFs, etc.) are not supported.",
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

      // Get file metadata first to determine how to read it
      const meta = await drive.files.get({
        fileId: params.file_id,
        fields: "id,name,mimeType",
      });

      const mimeType = meta.data.mimeType ?? "";
      const exportMime = EXPORT_MIME[mimeType];

      let content: string;
      let exportedAs: string;

      if (exportMime) {
        // Google Workspace file — export as text
        const res = await drive.files.export(
          { fileId: params.file_id, mimeType: exportMime },
          { responseType: "text" },
        );
        content = res.data as string;
        exportedAs = exportMime;
      } else if (
        mimeType.startsWith("text/") ||
        mimeType === "application/json" ||
        mimeType === "application/xml"
      ) {
        // Plain text file — download directly
        const res = await drive.files.get(
          { fileId: params.file_id, alt: "media" },
          { responseType: "text" },
        );
        content = res.data as string;
        exportedAs = mimeType;
      } else {
        return jsonResult({
          error: "unsupported_mime_type",
          mimeType,
          message:
            "This file type cannot be read as text. Supported types: Google Docs, Google Sheets, Google Slides, and plain-text files.",
        });
      }

      return jsonResult({
        id: params.file_id,
        name: meta.data.name ?? "",
        mimeType,
        exportedAs,
        content,
      });
    },
  };
}
