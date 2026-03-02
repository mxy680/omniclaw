import { writeFileSync } from "fs";
import { join } from "path";
import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { ensureDir, sanitizeFilename, mimeToExt } from "./media-utils.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("docs");

// Maps user-facing format string to the Drive export MIME type and file extension.
const FORMAT_MAP: Record<string, { exportMime: string; ext: string }> = {
  pdf: {
    exportMime: "application/pdf",
    ext: ".pdf",
  },
  docx: {
    exportMime:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ".docx",
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDocsExportTool(clientManager: OAuthClientManager): any {
  return {
    name: "docs_export",
    label: "Docs Export",
    description: "Export a Google Doc to local disk as PDF or DOCX.",
    parameters: Type.Object({
      document_id: Type.String({
        description: "The Google Doc document ID.",
      }),
      save_dir: Type.String({
        description: "Directory to save the exported file.",
      }),
      format: Type.Optional(
        Type.String({
          description: "Export format: 'pdf' (default) or 'docx'.",
          default: "pdf",
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
      params: {
        document_id: string;
        save_dir: string;
        format?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const formatKey = (params.format ?? "pdf").toLowerCase();
        const formatEntry = FORMAT_MAP[formatKey];
        if (!formatEntry) {
          return jsonResult({
            success: false,
            error: `Unsupported format '${formatKey}'. Supported values: ${Object.keys(FORMAT_MAP).join(", ")}.`,
          });
        }

        const client = clientManager.getClient(account);
        const drive = google.drive({ version: "v3", auth: client });

        // Fetch document metadata to get the display name.
        const metaRes = await drive.files.get({
          fileId: params.document_id,
          fields: "id,name",
        });
        const rawName = metaRes.data.name ?? params.document_id;

        const exportMime = formatEntry.exportMime;
        const res = await drive.files.export(
          { fileId: params.document_id, mimeType: exportMime },
          { responseType: "arraybuffer" },
        );
        const data = res.data as ArrayBuffer;

        ensureDir(params.save_dir);

        // Strip any existing extension from the Drive name to avoid doubling,
        // then append the correct extension for the exported format.
        const baseName = sanitizeFilename(rawName.replace(/\.[^/.]+$/, ""));
        const ext = mimeToExt(exportMime);
        const filename = baseName + ext;
        const filepath = join(params.save_dir, filename);

        writeFileSync(filepath, Buffer.from(data));

        return jsonResult({
          success: true,
          path: filepath,
          filename,
          mimeType: exportMime,
          size: Buffer.byteLength(Buffer.from(data)),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ success: false, error: message });
      }
    },
  };
}
