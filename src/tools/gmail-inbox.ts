import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

interface MessageSummary {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

async function fetchMessages(
  clientManager: OAuthClientManager,
  account: string,
  maxResults: number,
  query?: string,
): Promise<MessageSummary[] | typeof AUTH_REQUIRED> {
  if (!clientManager.listAccounts().includes(account)) {
    return AUTH_REQUIRED;
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults,
    ...(query ? { q: query } : {}),
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  const summaries = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });
      const headers = detail.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
      return {
        id: msg.id ?? "",
        subject: get("Subject"),
        from: get("From"),
        date: get("Date"),
        snippet: detail.data.snippet ?? "",
      };
    }),
  );

  return summaries;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailInboxTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_inbox",
    label: "Gmail Inbox",
    description:
      "List recent Gmail inbox messages. Returns up to max_results emails with id, subject, from, date, and snippet. Use gmail_auth_setup first if not authenticated.",
    parameters: Type.Object({
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of messages to return. Defaults to 20.",
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
      const result = await fetchMessages(clientManager, account, maxResults);
      return jsonResult(result);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailSearchTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_search",
    label: "Gmail Search",
    description:
      "Search Gmail messages using Gmail query syntax (e.g. 'from:alice after:2025/01/01 has:attachment'). Returns matching messages with id, subject, from, date, snippet.",
    parameters: Type.Object({
      query: Type.String({
        description: "Gmail search query (e.g. 'from:alice has:attachment is:unread').",
      }),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of messages to return. Defaults to 20.",
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
    async execute(
      _toolCallId: string,
      params: { query: string; max_results?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const maxResults = params.max_results ?? 20;
      const result = await fetchMessages(clientManager, account, maxResults, params.query);
      return jsonResult(result);
    },
  };
}
