import { Type } from "@sinclair/typebox";
import { statSync } from "fs";
import { join } from "path";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";
import {
  ensureDir,
  sanitizeFilename,
  mimeToExt,
  downloadUrlWithCookies,
} from "./media-utils.js";

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
  action: "Call linkedin_auth_setup to authenticate with LinkedIn first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInDownloadMediaTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_download_media",
    label: "LinkedIn Download Media",
    description:
      "Download a LinkedIn media file (image or video) to local disk. Pass any LinkedIn media URL from tool responses (e.g. from linkedin_feed, linkedin_profile).",
    parameters: Type.Object({
      url: Type.String({
        description: "LinkedIn media URL to download.",
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
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { url: string; save_dir: string; filename?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const session = linkedinManager.getCredentials(account)!;

        // Build cookie string from all_cookies, falling back to the core session cookies
        const cookieStr =
          Object.keys(session.all_cookies).length > 0
            ? Object.entries(session.all_cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join("; ")
            : `li_at=${session.li_at}; JSESSIONID="${session.jsessionid}"`;

        ensureDir(params.save_dir);

        // HEAD request to resolve MIME type without downloading the full body
        const headRes = await fetch(params.url, {
          method: "HEAD",
          headers: { Cookie: cookieStr },
        });

        const contentType =
          headRes.headers.get("content-type") ?? "application/octet-stream";
        const mimeType = contentType.split(";")[0].trim();
        const ext = mimeToExt(mimeType);

        let filename: string;
        if (params.filename) {
          filename = sanitizeFilename(params.filename);
        } else {
          filename = `linkedin-media-${Date.now()}${ext}`;
        }

        const filepath = join(params.save_dir, filename);
        await downloadUrlWithCookies(params.url, filepath, cookieStr);

        const size = statSync(filepath).size;

        return jsonResult({
          path: filepath,
          mimeType,
          source_url: params.url,
          size,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
