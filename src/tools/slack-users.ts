import { Type } from "@sinclair/typebox";
import type { SlackClientManager } from "../auth/slack-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./slack-utils.js";

interface SlackUser {
  id: string;
  name?: string;
  real_name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  profile?: {
    display_name?: string;
    real_name?: string;
    status_text?: string;
    status_emoji?: string;
    title?: string;
    email?: string;
    image_72?: string;
  };
  tz?: string;
  tz_label?: string;
  updated?: number;
}

function formatUser(user: SlackUser): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name ?? null,
    real_name: user.real_name ?? user.profile?.real_name ?? null,
    display_name: user.profile?.display_name || user.name || null,
    title: user.profile?.title ?? null,
    email: user.profile?.email ?? null,
    status_text: user.profile?.status_text || null,
    status_emoji: user.profile?.status_emoji || null,
    is_bot: user.is_bot ?? false,
    is_admin: user.is_admin ?? false,
    deleted: user.deleted ?? false,
    tz: user.tz ?? null,
    avatar: user.profile?.image_72 ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlackListUsersTool(manager: SlackClientManager): any {
  return {
    name: "slack_list_users",
    label: "Slack Users",
    description:
      "List members of the Slack workspace. Returns user id, name, display name, status, and profile info. Supports pagination via cursor.",
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({
          description: "Max users per page (1-1000). Defaults to 100.",
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
      params: { limit?: number; cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const apiParams: Record<string, unknown> = {
          limit: params.limit ?? 100,
        };
        if (params.cursor) apiParams.cursor = params.cursor;

        const data = (await manager.post(
          account,
          "users.list",
          apiParams,
        )) as {
          members: SlackUser[];
          response_metadata?: { next_cursor?: string };
        };

        const users = data.members.map(formatUser);

        const result: Record<string, unknown> = {
          count: users.length,
          users,
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
export function createSlackGetUserInfoTool(manager: SlackClientManager): any {
  return {
    name: "slack_get_user_info",
    label: "Slack User Info",
    description:
      "Get detailed profile information for a specific Slack user by their user ID.",
    parameters: Type.Object({
      user: Type.String({
        description: "The user ID (e.g. 'U01234ABCDE').",
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
      params: { user: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const data = (await manager.post(account, "users.info", {
          user: params.user,
        })) as {
          user: SlackUser;
        };

        return jsonResult(formatUser(data.user));
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
