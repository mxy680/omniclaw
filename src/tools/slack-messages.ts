import { Type } from "@sinclair/typebox";
import type { SlackClientManager } from "../auth/slack-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./slack-utils.js";

interface SlackMessage {
  type?: string;
  subtype?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  reactions?: Array<{ name: string; count: number; users?: string[] }>;
  files?: Array<{ name: string; mimetype?: string; url_private?: string }>;
  attachments?: Array<{ fallback?: string; text?: string; title?: string }>;
}

function formatMessage(msg: SlackMessage): Record<string, unknown> {
  return {
    user: msg.user ?? null,
    text: msg.text ?? "",
    ts: msg.ts ?? null,
    thread_ts: msg.thread_ts ?? null,
    reply_count: msg.reply_count ?? null,
    subtype: msg.subtype ?? null,
    reactions:
      msg.reactions?.map((r) => ({ name: r.name, count: r.count })) ?? [],
    has_files: (msg.files?.length ?? 0) > 0,
    files: msg.files?.map((f) => ({ name: f.name, type: f.mimetype })) ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlackListMessagesTool(manager: SlackClientManager): any {
  return {
    name: "slack_list_messages",
    label: "Slack Messages",
    description:
      "List recent messages from a Slack channel. Returns message text, author, timestamp, reactions, and thread info. " +
      "Use oldest/latest (Unix timestamps) to filter by date range.",
    parameters: Type.Object({
      channel: Type.String({
        description: "The channel ID (e.g. 'C01234ABCDE').",
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Max messages to return (1-1000). Defaults to 50.",
        }),
      ),
      cursor: Type.Optional(
        Type.String({
          description: "Pagination cursor from a previous response.",
        }),
      ),
      oldest: Type.Optional(
        Type.String({
          description: "Only messages after this Unix timestamp (e.g. '1609459200').",
        }),
      ),
      latest: Type.Optional(
        Type.String({
          description: "Only messages before this Unix timestamp.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Slack account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        channel: string;
        limit?: number;
        cursor?: string;
        oldest?: string;
        latest?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const apiParams: Record<string, unknown> = {
          channel: params.channel,
          limit: params.limit ?? 50,
        };
        if (params.cursor) apiParams.cursor = params.cursor;
        if (params.oldest) apiParams.oldest = params.oldest;
        if (params.latest) apiParams.latest = params.latest;

        const data = (await manager.post(
          account,
          "conversations.history",
          apiParams,
        )) as {
          messages: SlackMessage[];
          has_more?: boolean;
          response_metadata?: { next_cursor?: string };
        };

        const messages = data.messages.map(formatMessage);

        const result: Record<string, unknown> = {
          count: messages.length,
          messages,
          has_more: data.has_more ?? false,
        };

        const nextCursor = data.response_metadata?.next_cursor;
        if (nextCursor) {
          result.next_cursor = nextCursor;
        }

        return jsonResult(result);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlackGetThreadTool(manager: SlackClientManager): any {
  return {
    name: "slack_get_thread",
    label: "Slack Thread",
    description:
      "Get all messages in a Slack thread. Requires the channel ID and the thread's parent message timestamp (thread_ts).",
    parameters: Type.Object({
      channel: Type.String({
        description: "The channel ID containing the thread.",
      }),
      thread_ts: Type.String({
        description:
          "The timestamp of the thread's parent message (e.g. '1234567890.123456').",
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Max replies to return (1-1000). Defaults to 100.",
        }),
      ),
      cursor: Type.Optional(
        Type.String({
          description: "Pagination cursor from a previous response.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Slack account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        channel: string;
        thread_ts: string;
        limit?: number;
        cursor?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const apiParams: Record<string, unknown> = {
          channel: params.channel,
          ts: params.thread_ts,
          limit: params.limit ?? 100,
        };
        if (params.cursor) apiParams.cursor = params.cursor;

        const data = (await manager.post(
          account,
          "conversations.replies",
          apiParams,
        )) as {
          messages: SlackMessage[];
          has_more?: boolean;
          response_metadata?: { next_cursor?: string };
        };

        const messages = data.messages.map(formatMessage);

        const result: Record<string, unknown> = {
          count: messages.length,
          messages,
          has_more: data.has_more ?? false,
        };

        const nextCursor = data.response_metadata?.next_cursor;
        if (nextCursor) {
          result.next_cursor = nextCursor;
        }

        return jsonResult(result);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
