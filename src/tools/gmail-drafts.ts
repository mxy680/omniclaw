import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

function encodeDraftMessage(headers: Record<string, string>, body: string): string {
  const headerLines = Object.entries(headers)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");
  const raw = `${headerLines}\r\n\r\n${body}`;
  return Buffer.from(raw).toString("base64url");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailDraftListTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_draft_list",
    label: "Gmail List Drafts",
    description: "List Gmail drafts. Returns draft id, messageId, subject, to, and snippet for each draft.",
    parameters: Type.Object({
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of drafts to return. Defaults to 20.",
          default: 20,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { max_results?: number; account?: string }) {
      const account = params.account ?? "default";
      const maxResults = params.max_results ?? 20;

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const listRes = await gmail.users.drafts.list({ userId: "me", maxResults });
      const drafts = listRes.data.drafts ?? [];

      if (drafts.length === 0) return jsonResult([]);

      const summaries = await Promise.all(
        drafts.map(async (draft) => {
          const detail = await gmail.users.drafts.get({
            userId: "me",
            id: draft.id!,
            format: "metadata",
          });
          const headers = detail.data.message?.payload?.headers ?? [];
          const get = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
          return {
            id: draft.id ?? "",
            messageId: detail.data.message?.id ?? "",
            subject: get("Subject"),
            to: get("To"),
            snippet: detail.data.message?.snippet ?? "",
          };
        }),
      );

      return jsonResult(summaries);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailDraftCreateTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_draft_create",
    label: "Gmail Create Draft",
    description: "Create a new Gmail draft.",
    parameters: Type.Object({
      to: Type.String({ description: "Recipient email address." }),
      subject: Type.String({ description: "Email subject line." }),
      body: Type.String({ description: "Plain-text email body." }),
      cc: Type.Optional(Type.String({ description: "CC email address(es)." })),
      bcc: Type.Optional(Type.String({ description: "BCC email address(es)." })),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { to: string; subject: string; body: string; cc?: string; bcc?: string; account?: string },
    ) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const raw = encodeDraftMessage(
        {
          To: params.to,
          Subject: params.subject,
          Cc: params.cc ?? "",
          Bcc: params.bcc ?? "",
          "Content-Type": "text/plain; charset=utf-8",
          "MIME-Version": "1.0",
        },
        params.body,
      );

      const res = await gmail.users.drafts.create({
        userId: "me",
        requestBody: { message: { raw } },
      });

      return jsonResult({ id: res.data.id, messageId: res.data.message?.id, success: true });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailDraftUpdateTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_draft_update",
    label: "Gmail Update Draft",
    description: "Update an existing Gmail draft by replacing its content.",
    parameters: Type.Object({
      draft_id: Type.String({ description: "The draft ID to update." }),
      to: Type.String({ description: "Recipient email address." }),
      subject: Type.String({ description: "Email subject line." }),
      body: Type.String({ description: "Plain-text email body." }),
      cc: Type.Optional(Type.String({ description: "CC email address(es)." })),
      bcc: Type.Optional(Type.String({ description: "BCC email address(es)." })),
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
        draft_id: string;
        to: string;
        subject: string;
        body: string;
        cc?: string;
        bcc?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const raw = encodeDraftMessage(
        {
          To: params.to,
          Subject: params.subject,
          Cc: params.cc ?? "",
          Bcc: params.bcc ?? "",
          "Content-Type": "text/plain; charset=utf-8",
          "MIME-Version": "1.0",
        },
        params.body,
      );

      const res = await gmail.users.drafts.update({
        userId: "me",
        id: params.draft_id,
        requestBody: { message: { raw } },
      });

      return jsonResult({ id: res.data.id, messageId: res.data.message?.id, success: true });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailDraftDeleteTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_draft_delete",
    label: "Gmail Delete Draft",
    description: "Permanently delete a Gmail draft.",
    parameters: Type.Object({
      draft_id: Type.String({ description: "The draft ID to delete." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { draft_id: string; account?: string }) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      await gmail.users.drafts.delete({ userId: "me", id: params.draft_id });

      return jsonResult({ draft_id: params.draft_id, success: true });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailDraftSendTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_draft_send",
    label: "Gmail Send Draft",
    description: "Send an existing Gmail draft.",
    parameters: Type.Object({
      draft_id: Type.String({ description: "The draft ID to send." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { draft_id: string; account?: string }) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const res = await gmail.users.drafts.send({
        userId: "me",
        requestBody: { id: params.draft_id },
      });

      return jsonResult({ id: res.data.id, threadId: res.data.threadId, success: true });
    },
  };
}
