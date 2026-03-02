import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailThreadListTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_thread_list",
    label: "Gmail List Threads",
    description: "List Gmail threads. Optionally filter by a Gmail search query. Returns thread id, snippet, and historyId for each thread.",
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({
          description: "Gmail search query to filter threads (e.g. 'from:alice is:unread').",
        }),
      ),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of threads to return. Defaults to 20.",
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
      params: { query?: string; max_results?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const maxResults = params.max_results ?? 20;

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const res = await gmail.users.threads.list({
        userId: "me",
        maxResults,
        ...(params.query ? { q: params.query } : {}),
      });

      const threads = res.data.threads ?? [];

      const result = threads.map((thread) => ({
        id: thread.id ?? "",
        snippet: thread.snippet ?? "",
        historyId: thread.historyId ?? "",
      }));

      return jsonResult(result);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGmailThreadGetTool(clientManager: OAuthClientManager): any {
  return {
    name: "gmail_thread_get",
    label: "Gmail Get Thread",
    description: "Fetch all messages in a Gmail thread. Returns the thread id and an array of messages with id, subject, from, date, and snippet.",
    parameters: Type.Object({
      thread_id: Type.String({ description: "The Gmail thread ID to fetch." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { thread_id: string; account?: string }) {
      const account = params.account ?? "default";

      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const gmail = google.gmail({ version: "v1", auth: client });

      const res = await gmail.users.threads.get({
        userId: "me",
        id: params.thread_id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });

      const messages = (res.data.messages ?? []).map((msg) => {
        const headers = msg.payload?.headers ?? [];
        const get = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
        return {
          id: msg.id ?? "",
          subject: get("Subject"),
          from: get("From"),
          date: get("Date"),
          snippet: msg.snippet ?? "",
        };
      });

      return jsonResult({ id: res.data.id ?? params.thread_id, messages });
    },
  };
}
