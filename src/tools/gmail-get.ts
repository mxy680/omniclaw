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
  action: "Call gmail_auth_setup to authenticate.",
};

interface MessagePart {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: MessagePart[] | null;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailGetTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_get",
    label: "Gmail Get Email",
    description:
      "Fetch the full body of a single Gmail message by ID. Returns subject, from, to, date, and both plain-text and HTML body. Use gmail_inbox or gmail_search to find message IDs.",
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

      return jsonResult({
        id: res.data.id ?? params.id,
        subject: get("Subject"),
        from: get("From"),
        to: get("To"),
        date: get("Date"),
        body_text: bodyText,
        body_html: bodyHtml,
      });
    },
  };
}
