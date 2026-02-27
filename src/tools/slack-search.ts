import { Type } from "@sinclair/typebox";
import type { SlackClientManager } from "../auth/slack-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./slack-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlackSearchMessagesTool(manager: SlackClientManager): any {
  return {
    name: "slack_search_messages",
    label: "Slack Search",
    description:
      "Search Slack messages across all channels. Supports Slack search syntax " +
      "(e.g. 'from:@user', 'in:#channel', 'has:link', 'before:2026-01-01', 'after:2025-06-01'). " +
      "Returns matching messages with channel context.",
    parameters: Type.Object({
      query: Type.String({
        description:
          "Search query. Supports Slack search operators: from:@user, in:#channel, " +
          "has:link, has:reaction, before:YYYY-MM-DD, after:YYYY-MM-DD, during:month/year.",
      }),
      sort: Type.Optional(
        Type.String({
          description: "Sort order: 'timestamp' (newest first) or 'score' (most relevant). Defaults to 'timestamp'.",
        }),
      ),
      sort_dir: Type.Optional(
        Type.String({
          description: "Sort direction: 'desc' or 'asc'. Defaults to 'desc'.",
        }),
      ),
      count: Type.Optional(
        Type.Number({
          description: "Number of results per page (1-100). Defaults to 20.",
        }),
      ),
      page: Type.Optional(
        Type.Number({
          description: "Page number (1-based). Defaults to 1.",
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
        query: string;
        sort?: string;
        sort_dir?: string;
        count?: number;
        page?: number;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const apiParams: Record<string, unknown> = {
          query: params.query,
          sort: params.sort ?? "timestamp",
          sort_dir: params.sort_dir ?? "desc",
          count: params.count ?? 20,
          page: params.page ?? 1,
        };

        const data = (await manager.post(
          account,
          "search.messages",
          apiParams,
        )) as {
          messages: {
            total: number;
            paging?: {
              count: number;
              total: number;
              page: number;
              pages: number;
            };
            matches: Array<{
              iid?: string;
              type?: string;
              user?: string;
              username?: string;
              text?: string;
              ts?: string;
              channel?: {
                id: string;
                name: string;
                is_private?: boolean;
              };
              permalink?: string;
              previous?: {
                user?: string;
                text?: string;
                ts?: string;
              };
              next?: {
                user?: string;
                text?: string;
                ts?: string;
              };
            }>;
          };
        };

        const matches = data.messages.matches.map((m) => ({
          user: m.user ?? m.username ?? null,
          text: m.text ?? "",
          ts: m.ts ?? null,
          channel_id: m.channel?.id ?? null,
          channel_name: m.channel?.name ?? null,
          is_private: m.channel?.is_private ?? false,
          permalink: m.permalink ?? null,
        }));

        return jsonResult({
          total: data.messages.total,
          page: data.messages.paging?.page ?? 1,
          pages: data.messages.paging?.pages ?? 1,
          count: matches.length,
          matches,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
