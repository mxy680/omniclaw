import { Type } from "@sinclair/typebox";
import type { SlackClientManager } from "../auth/slack-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./slack-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlackListChannelsTool(manager: SlackClientManager): any {
  return {
    name: "slack_list_channels",
    label: "Slack List Channels",
    description:
      "List Slack channels (public, private, DMs, group DMs). " +
      "Returns channel id, name, topic, purpose, and member count. Supports pagination via cursor.",
    parameters: Type.Object({
      types: Type.Optional(
        Type.String({
          description:
            "Comma-separated channel types to include: public_channel, private_channel, mpim, im. " +
            "Defaults to 'public_channel,private_channel'.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Max channels per page (1-1000). Defaults to 100.",
        }),
      ),
      cursor: Type.Optional(
        Type.String({
          description: "Pagination cursor from a previous response.",
        }),
      ),
      exclude_archived: Type.Optional(
        Type.Boolean({
          description: "Exclude archived channels. Defaults to true.",
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
        types?: string;
        limit?: number;
        cursor?: string;
        exclude_archived?: boolean;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const apiParams: Record<string, unknown> = {
          types: params.types ?? "public_channel,private_channel",
          limit: params.limit ?? 100,
          exclude_archived: params.exclude_archived !== false ? "true" : "false",
        };
        if (params.cursor) apiParams.cursor = params.cursor;

        const data = (await manager.post(account, "conversations.list", apiParams)) as {
          channels: Array<{
            id: string;
            name: string;
            name_normalized?: string;
            is_channel?: boolean;
            is_group?: boolean;
            is_im?: boolean;
            is_mpim?: boolean;
            is_private?: boolean;
            is_archived?: boolean;
            is_member?: boolean;
            topic?: { value: string };
            purpose?: { value: string };
            num_members?: number;
            creator?: string;
            created?: number;
          }>;
          response_metadata?: { next_cursor?: string };
        };

        const channels = data.channels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private ?? false,
          is_im: ch.is_im ?? false,
          is_mpim: ch.is_mpim ?? false,
          is_archived: ch.is_archived ?? false,
          is_member: ch.is_member ?? false,
          topic: ch.topic?.value || null,
          purpose: ch.purpose?.value || null,
          num_members: ch.num_members ?? null,
          creator: ch.creator ?? null,
        }));

        const result: Record<string, unknown> = {
          count: channels.length,
          channels,
        };

        const nextCursor = data.response_metadata?.next_cursor;
        if (nextCursor) {
          result.next_cursor = nextCursor;
          result.has_more = true;
        }

        return jsonResult(result);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlackGetChannelInfoTool(manager: SlackClientManager): any {
  return {
    name: "slack_get_channel_info",
    label: "Slack Channel Info",
    description:
      "Get detailed information about a specific Slack channel by its ID.",
    parameters: Type.Object({
      channel: Type.String({
        description: "The channel ID (e.g. 'C01234ABCDE').",
      }),
      account: Type.Optional(
        Type.String({
          description: "Slack account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { channel: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const data = (await manager.post(account, "conversations.info", {
          channel: params.channel,
        })) as {
          channel: {
            id: string;
            name: string;
            name_normalized?: string;
            is_channel?: boolean;
            is_group?: boolean;
            is_im?: boolean;
            is_mpim?: boolean;
            is_private?: boolean;
            is_archived?: boolean;
            is_member?: boolean;
            topic?: { value: string; creator?: string; last_set?: number };
            purpose?: { value: string; creator?: string; last_set?: number };
            num_members?: number;
            creator?: string;
            created?: number;
            last_read?: string;
            unread_count?: number;
          };
        };

        const ch = data.channel;
        return jsonResult({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private ?? false,
          is_im: ch.is_im ?? false,
          is_mpim: ch.is_mpim ?? false,
          is_archived: ch.is_archived ?? false,
          is_member: ch.is_member ?? false,
          topic: ch.topic?.value || null,
          purpose: ch.purpose?.value || null,
          num_members: ch.num_members ?? null,
          creator: ch.creator ?? null,
          created: ch.created ?? null,
          last_read: ch.last_read ?? null,
          unread_count: ch.unread_count ?? null,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
