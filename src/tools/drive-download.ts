import { writeFileSync } from "fs";
import { join } from "path";
import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { ensureDir, mimeToExt, sanitizeFilename } from "./media-utils.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("drive");

// Maps Google Workspace MIME types to their export MIME type and file extension.
// Documents and Presentations export as PDF; Spreadsheets export as XLSX.
const WORKSPACE_EXPORT_MAP: Record<string, { exportMime: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    exportMime: "application/pdf",
    ext: ".pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    exportMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: ".xlsx",
  },
  "application/vnd.google-apps.presentation": {
    exportMime: "application/pdf",
    ext: ".pdf",
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDriveDownloadTool(clientManager: OAuthClientManager): any {
  return {
    name: "drive_download",
    label: "Drive Download File",
    description:
      "Download a file from Google Drive to local disk. Supports both regular files and Google Workspace files (Docs→PDF, Sheets→XLSX, Slides→PDF).",
    parameters: Type.Object({
      file_id: Type.String({ description: "The Google Drive file ID to download." }),
      save_dir: Type.String({
        description: "Local directory path where the file will be saved.",
      }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { file_id: string; save_dir: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const client = clientManager.getClient(account);
        const drive = google.drive({ version: "v3", auth: client });

        // Fetch file metadata to determine name, MIME type, and size
        const metaRes = await drive.files.get({
          fileId: params.file_id,
          fields: "id,name,mimeType,size",
        });
        const meta = metaRes.data;
        const rawName = meta.name ?? params.file_id;
        const mimeType = meta.mimeType ?? "application/octet-stream";

        let data: ArrayBuffer;
        let finalMimeType: string;
        let ext: string;

        const workspaceExport = WORKSPACE_EXPORT_MAP[mimeType];
        if (workspaceExport) {
          // Google Workspace file — must be exported, not downloaded directly
          const exportRes = await drive.files.export(
            { fileId: params.file_id, mimeType: workspaceExport.exportMime },
            { responseType: "arraybuffer" },
          );
          data = exportRes.data as ArrayBuffer;
          finalMimeType = workspaceExport.exportMime;
          ext = workspaceExport.ext;
        } else {
          // Regular binary or text file — download via alt=media
          const dlRes = await drive.files.get(
            { fileId: params.file_id, alt: "media" },
            { responseType: "arraybuffer" },
          );
          data = dlRes.data as ArrayBuffer;
          finalMimeType = mimeType;
          ext = mimeToExt(mimeType);
        }

        ensureDir(params.save_dir);

        // Strip any existing extension from the Drive name to avoid doubling,
        // then append the correct extension for the downloaded format.
        const baseName = sanitizeFilename(rawName.replace(/\.[^/.]+$/, ""));
        const filename = baseName + ext;
        const filepath = join(params.save_dir, filename);

        writeFileSync(filepath, Buffer.from(data));

        return jsonResult({
          success: true,
          path: filepath,
          filename,
          mimeType: finalMimeType,
          size: Buffer.byteLength(Buffer.from(data)),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ success: false, error: message });
      }
    },
  };
}
