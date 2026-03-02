import { readFileSync } from "fs";
import { basename, extname } from "path";
import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { extToMime } from "./media-utils.js";
import { jsonResult, authRequired } from "./shared.js";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

const AUTH_REQUIRED = authRequired("gmail");

interface AttachmentInput {
  file_path: string;
  filename?: string;
}

function encodeMessage(headers: Record<string, string>, body: string): string {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");
  const raw = `${headerLines}\r\n\r\n${body}`;
  return Buffer.from(raw).toString("base64url");
}

function encodeMultipartMessage(
  headers: Record<string, string>,
  body: string,
  attachments: AttachmentInput[] | undefined,
): string {
  // No attachments — fall back to simple encoding for backward compatibility.
  if (!attachments || attachments.length === 0) {
    return encodeMessage(headers, body);
  }

  const boundary = `----=_Part_${Date.now()}`;

  // Override Content-Type to multipart/mixed with our boundary.
  const multipartHeaders: Record<string, string> = {
    ...headers,
    "Content-Type": `multipart/mixed; boundary="${boundary}"`,
  };

  const headerLines = Object.entries(multipartHeaders)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");

  const parts: string[] = [];

  // Text/plain body part.
  parts.push(
    [
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      body,
    ].join("\r\n"),
  );

  // One part per attachment.
  for (const att of attachments) {
    const fileBuffer = readFileSync(att.file_path);
    const name = att.filename ?? basename(att.file_path);
    const ext = extname(name);
    const mimeType = extToMime(ext) || "application/octet-stream";
    const encoded = fileBuffer.toString("base64");

    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${mimeType}; name="${name}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${name}"`,
        "",
        encoded,
      ].join("\r\n"),
    );
  }

  // Final boundary.
  const rawBody = parts.join("\r\n") + `\r\n--${boundary}--`;

  const raw = `${headerLines}\r\n\r\n${rawBody}`;
  return Buffer.from(raw).toString("base64url");
}

async function getSenderEmail(client: OAuth2Client): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const res = await gmail.users.getProfile({ userId: "me" });
  return res.data.emailAddress ?? "me";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailSendTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_send",
    label: "Gmail Send Email",
    description: "Send a new email via Gmail.",
    parameters: Type.Object({
      to: Type.String({ description: "Recipient email address." }),
      subject: Type.String({ description: "Email subject line." }),
      body: Type.String({ description: "Plain-text email body." }),
      attachments: Type.Optional(
        Type.Array(
          Type.Object({
            file_path: Type.String({ description: "Path to the file on disk to attach." }),
            filename: Type.Optional(
              Type.String({ description: "Override filename for the attachment." }),
            ),
          }),
          { description: "Optional list of file attachments." },
        ),
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
        to: string;
        subject: string;
        body: string;
        attachments?: AttachmentInput[];
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });
      const from = await getSenderEmail(client);

      const raw = encodeMultipartMessage(
        {
          From: from,
          To: params.to,
          Subject: params.subject,
          "Content-Type": "text/plain; charset=utf-8",
          "MIME-Version": "1.0",
        },
        params.body,
        params.attachments,
      );

      const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

      return jsonResult({ id: res.data.id, threadId: res.data.threadId, success: true });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailReplyTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_reply",
    label: "Gmail Reply",
    description:
      "Reply to an existing Gmail message, keeping it in the same thread. Provide the original message ID and your reply body.",
    parameters: Type.Object({
      id: Type.String({ description: "The Gmail message ID to reply to." }),
      body: Type.String({ description: "Plain-text reply body." }),
      attachments: Type.Optional(
        Type.Array(
          Type.Object({
            file_path: Type.String({ description: "Path to the file on disk to attach." }),
            filename: Type.Optional(
              Type.String({ description: "Override filename for the attachment." }),
            ),
          }),
          { description: "Optional list of file attachments." },
        ),
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
        id: string;
        body: string;
        attachments?: AttachmentInput[];
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const orig = await gmail.users.messages.get({
        userId: "me",
        id: params.id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Message-ID", "References"],
      });

      const headers = orig.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const origSubject = get("Subject");
      const origFrom = get("From");
      const origMessageId = get("Message-ID");
      const origReferences = get("References");
      const threadId = orig.data.threadId ?? undefined;

      const replySubject = origSubject.startsWith("Re:") ? origSubject : `Re: ${origSubject}`;
      const references = origReferences ? `${origReferences} ${origMessageId}` : origMessageId;

      const from = await getSenderEmail(client);

      const raw = encodeMultipartMessage(
        {
          From: from,
          To: origFrom,
          Subject: replySubject,
          "In-Reply-To": origMessageId,
          References: references,
          "Content-Type": "text/plain; charset=utf-8",
          "MIME-Version": "1.0",
        },
        params.body,
        params.attachments,
      );

      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw, threadId },
      });

      return jsonResult({ id: res.data.id, threadId: res.data.threadId, success: true });
    },
  };
}

interface MessagePart {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: MessagePart[] | null;
}

function extractPlainText(parts: MessagePart[] | null | undefined): string {
  let text = "";
  function traverse(part: MessagePart) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      for (const child of part.parts) traverse(child);
    }
  }
  if (parts) {
    for (const part of parts) traverse(part);
  }
  return text;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailForwardTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_forward",
    label: "Gmail Forward",
    description:
      "Forward an existing Gmail message to another recipient, optionally adding a note.",
    parameters: Type.Object({
      id: Type.String({ description: "The Gmail message ID to forward." }),
      to: Type.String({ description: "Recipient email address to forward to." }),
      body: Type.Optional(
        Type.String({
          description: "Optional introductory note to prepend before the forwarded message.",
        }),
      ),
      attachments: Type.Optional(
        Type.Array(
          Type.Object({
            file_path: Type.String({ description: "Path to the file on disk to attach." }),
            filename: Type.Optional(
              Type.String({ description: "Override filename for the attachment." }),
            ),
          }),
          { description: "Optional list of additional file attachments." },
        ),
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
        id: string;
        to: string;
        body?: string;
        attachments?: AttachmentInput[];
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const orig = await gmail.users.messages.get({
        userId: "me",
        id: params.id,
        format: "full",
      });

      const headers = orig.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const origSubject = get("Subject");
      const origFrom = get("From");
      const origDate = get("Date");

      const fwdSubject = origSubject.startsWith("Fwd:") ? origSubject : `Fwd: ${origSubject}`;

      let origBody = "";
      if (orig.data.payload?.body?.data) {
        origBody = Buffer.from(orig.data.payload.body.data, "base64").toString("utf-8");
      } else {
        origBody = extractPlainText(orig.data.payload?.parts as MessagePart[] | undefined);
      }

      const quotedBody = [
        params.body ?? "",
        "",
        "---------- Forwarded message ---------",
        `From: ${origFrom}`,
        `Date: ${origDate}`,
        `Subject: ${origSubject}`,
        "",
        origBody,
      ]
        .join("\r\n")
        .trimStart();

      const from = await getSenderEmail(client);

      const raw = encodeMultipartMessage(
        {
          From: from,
          To: params.to,
          Subject: fwdSubject,
          "Content-Type": "text/plain; charset=utf-8",
          "MIME-Version": "1.0",
        },
        quotedBody,
        params.attachments,
      );

      const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

      return jsonResult({ id: res.data.id, threadId: res.data.threadId, success: true });
    },
  };
}
