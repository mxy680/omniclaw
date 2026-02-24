import { Type } from "@sinclair/typebox";
import { writeFileSync } from "fs";
import { join } from "path";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { ensureDir, sanitizeFilename, mimeToExt } from "./media-utils.js";

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
  action: "Call instagram_auth_setup to authenticate with Instagram first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramDownloadMediaTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_download_media",
    label: "Instagram Download Media",
    description:
      "Download an Instagram image or video to local disk. Pass any Instagram CDN URL from tool responses (e.g. scontent-*.cdninstagram.com URLs from instagram_feed, instagram_posts, instagram_reels, etc.).",
    parameters: Type.Object({
      url: Type.String({
        description: "Instagram CDN URL to download.",
      }),
      save_dir: Type.String({
        description: "Directory to save the downloaded file.",
      }),
      filename: Type.Optional(
        Type.String({
          description: "Custom filename. Auto-generated if omitted.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Instagram account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { url: string; save_dir: string; filename?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        ensureDir(params.save_dir);

        const res = await fetch(params.url);
        if (!res.ok) {
          throw new Error(`Download failed: ${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        const mimeType = contentType.split(";")[0].trim();

        let filename: string;
        if (params.filename) {
          filename = sanitizeFilename(params.filename);
        } else {
          // Try to extract a meaningful name from the URL path, stripping query strings
          const urlPath = new URL(params.url).pathname;
          const rawName = urlPath.split("/").filter(Boolean).pop() ?? "";
          if (rawName) {
            filename = sanitizeFilename(rawName);
          } else {
            filename = `instagram-media-${Date.now()}${mimeToExt(mimeType)}`;
          }
        }

        const filepath = join(params.save_dir, filename);
        const buffer = Buffer.from(await res.arrayBuffer());
        writeFileSync(filepath, buffer);

        return jsonResult({
          path: filepath,
          mimeType,
          source_url: params.url,
          size: buffer.length,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
