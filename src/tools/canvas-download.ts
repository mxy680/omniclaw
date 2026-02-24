import { writeFileSync, statSync } from "fs";
import { join } from "path";
import { Type } from "@sinclair/typebox";
import type { CanvasClientManager } from "../auth/canvas-client-manager.js";
import { ensureDir, sanitizeFilename, mimeToExt } from "./media-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const CANVAS_AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call canvas_auth_setup with your Canvas base_url and api_token.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCanvasDownloadFileTool(canvasManager: CanvasClientManager): any {
  return {
    name: "canvas_download_file",
    label: "Canvas Download File",
    description:
      "Download a file from Canvas LMS to local disk. Use with file URLs from canvas_submissions or other Canvas tools.",
    parameters: Type.Object({
      url: Type.String({
        description:
          "Canvas file URL to download (from submission attachments, assignment files, etc.).",
      }),
      save_dir: Type.String({
        description: "Directory to save the downloaded file.",
      }),
      filename: Type.Optional(
        Type.String({
          description: "Custom filename. Auto-detected from URL if omitted.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Canvas account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { url: string; save_dir: string; filename?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!canvasManager.hasCredentials(account)) {
        return jsonResult(CANVAS_AUTH_REQUIRED);
      }

      try {
        const session = canvasManager.getCredentials(account)!;

        // Build cookie string — prefer the full all_cookies map so every
        // session-related cookie (including _legacy_normandy_session etc.)
        // is forwarded, falling back to the canvas_session value alone.
        const cookieStr =
          Object.keys(session.all_cookies).length > 0
            ? Object.entries(session.all_cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join("; ")
            : `canvas_session=${session.canvas_session}`;

        // Build request headers — include CSRF token so Canvas does not
        // reject the request as a cross-site forgery attempt.
        const headers: Record<string, string> = { Cookie: cookieStr };
        const csrf =
          session.csrf_meta_token || decodeURIComponent(session._csrf_token || "");
        if (csrf) {
          headers["X-CSRF-Token"] = csrf;
        }

        ensureDir(params.save_dir);

        const res = await fetch(params.url, { headers });
        if (!res.ok) {
          return jsonResult({
            error: `Download failed: ${res.status} ${res.statusText}`,
            url: params.url,
          });
        }

        // Determine MIME type from the response Content-Type header.
        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        // Strip parameters like "; charset=utf-8"
        const mimeType = contentType.split(";")[0].trim();
        const ext = mimeToExt(mimeType);

        // Resolve filename in priority order:
        //   1. Caller-supplied filename
        //   2. Content-Disposition header filename
        //   3. Last path segment of the URL
        //   4. Timestamped fallback
        let usedFilename: string;
        if (params.filename) {
          usedFilename = sanitizeFilename(params.filename);
        } else {
          const disposition = res.headers.get("content-disposition") ?? "";
          const dispMatch =
            disposition.match(/filename\*=UTF-8''([^;]+)/i) ??
            disposition.match(/filename="?([^";]+)"?/i);

          if (dispMatch) {
            usedFilename = sanitizeFilename(decodeURIComponent(dispMatch[1].trim()));
          } else {
            // Attempt to extract a meaningful name from the URL path, ignoring
            // query string parameters that Canvas appends for auth/versioning.
            const urlPath = new URL(params.url).pathname;
            const lastSegment = urlPath.split("/").filter(Boolean).pop() ?? "";
            if (lastSegment) {
              usedFilename = sanitizeFilename(decodeURIComponent(lastSegment));
              // If the segment has no recognisable extension, append the
              // MIME-derived one so the file opens correctly.
              if (!usedFilename.includes(".")) {
                usedFilename = usedFilename + ext;
              }
            } else {
              usedFilename = `canvas-file-${Date.now()}${ext}`;
            }
          }
        }

        const filepath = join(params.save_dir, usedFilename);
        writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));

        const size = statSync(filepath).size;

        return jsonResult({
          success: true,
          path: filepath,
          filename: usedFilename,
          mimeType,
          size,
        });
      } catch (err) {
        return jsonResult({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
