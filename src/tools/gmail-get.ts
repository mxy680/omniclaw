import { writeFileSync } from "fs";
import * as path from "path";
import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { ensureDir, sanitizeFilename, extToMime } from "./media-utils.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

interface MessagePart {
  partId?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  headers?: Array<{ name?: string | null; value?: string | null }> | null;
  body?: { data?: string | null; attachmentId?: string | null; size?: number | null } | null;
  parts?: MessagePart[] | null;
}

interface AttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  partId: string;
}

function extractBody(parts: MessagePart[] | null | undefined): { text: string; html: string } {
  let text = "";
  let html = "";

  function traverse(part: MessagePart) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += Buffer.from(part.body.data, "base64").toString("utf-8");
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html += Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      for (const child of part.parts) {
        traverse(child);
      }
    }
  }

  if (parts) {
    for (const part of parts) {
      traverse(part);
    }
  }

  return { text, html };
}

function extractAttachments(parts: MessagePart[] | null | undefined): AttachmentMeta[] {
  const results: AttachmentMeta[] = [];

  function traverse(part: MessagePart) {
    // A part is an attachment if it has an attachmentId in its body, or has a non-empty filename.
    // Parts with inline body data (data field populated) but no attachmentId are inline content,
    // not downloadable attachments — skip those.
    const attachmentId = part.body?.attachmentId ?? null;
    const filenameHeader = part.headers?.find(
      (h) => h.name?.toLowerCase() === "content-disposition",
    )?.value;

    // Prefer the part's own filename field; fall back to parsing Content-Disposition.
    let filename = part.filename ?? null;
    if (!filename && filenameHeader) {
      const match = filenameHeader.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
      if (match) {
        filename = decodeURIComponent(match[1].trim());
      }
    }

    if (attachmentId && filename) {
      results.push({
        filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        size: part.body?.size ?? 0,
        attachmentId,
        partId: part.partId ?? "",
      });
    }

    if (part.parts) {
      for (const child of part.parts) {
        traverse(child);
      }
    }
  }

  if (parts) {
    for (const part of parts) {
      traverse(part);
    }
  }

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailGetTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_get",
    label: "Gmail Get Email",
    description:
      "Fetch the full body of a single Gmail message by ID. Returns threadId, subject, from, to, cc, bcc, reply_to, date, snippet, labelIds, both plain-text and HTML body, and a list of attachments with their IDs. Use gmail_inbox or gmail_search to find message IDs.",
    parameters: Type.Object({
      id: Type.String({ description: "The Gmail message ID to fetch." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { id: string; account?: string }) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const res = await gmail.users.messages.get({
        userId: "me",
        id: params.id,
        format: "full",
      });

      const payload = res.data.payload;
      const headers = payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      let bodyText = "";
      let bodyHtml = "";

      if (payload?.body?.data) {
        // Single-part message
        const decoded = Buffer.from(payload.body.data, "base64").toString("utf-8");
        if (payload.mimeType === "text/html") {
          bodyHtml = decoded;
        } else {
          bodyText = decoded;
        }
      } else {
        const { text, html } = extractBody(payload?.parts as MessagePart[] | undefined);
        bodyText = text;
        bodyHtml = html;
      }

      const attachments = extractAttachments(payload?.parts as MessagePart[] | undefined);

      return jsonResult({
        id: res.data.id ?? params.id,
        threadId: res.data.threadId ?? "",
        subject: get("Subject"),
        from: get("From"),
        to: get("To"),
        cc: get("Cc"),
        bcc: get("Bcc"),
        reply_to: get("Reply-To"),
        date: get("Date"),
        snippet: res.data.snippet ?? "",
        labelIds: res.data.labelIds ?? [],
        body_text: bodyText,
        body_html: bodyHtml,
        attachments,
      });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailDownloadAttachmentTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_download_attachment",
    label: "Gmail Download Attachment",
    description:
      "Download an email attachment to disk. Use gmail_get to find attachment IDs first.",
    parameters: Type.Object({
      id: Type.String({ description: "The Gmail message ID containing the attachment." }),
      attachment_id: Type.String({
        description: "The attachment ID returned by gmail_get.",
      }),
      filename: Type.String({
        description: "The filename to save the attachment as (will be sanitized).",
      }),
      save_dir: Type.String({
        description: "Directory path where the attachment will be saved.",
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
      params: {
        id: string;
        attachment_id: string;
        filename: string;
        save_dir: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const res = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: params.id,
        id: params.attachment_id,
      });

      const data = res.data.data;
      if (!data) {
        return jsonResult({ error: "no_data", message: "Attachment returned no data." });
      }

      const buffer = Buffer.from(data, "base64url");

      ensureDir(params.save_dir);
      const safeFilename = sanitizeFilename(params.filename);
      const filePath = path.join(params.save_dir, safeFilename);
      writeFileSync(filePath, buffer);

      const ext = path.extname(safeFilename);
      const mimeType = extToMime(ext) || "application/octet-stream";

      return jsonResult({
        path: filePath,
        filename: safeFilename,
        mimeType,
        size: buffer.length,
      });
    },
  };
}
