import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { formatTimestamp, formatUser } from "./instagram-utils.js";

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
  action: "Call instagram_auth_setup to authenticate with Instagram first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramConversationsTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_conversations",
    label: "Instagram Conversations",
    description: "List your Instagram Direct Message conversations (inbox). Returns conversation threads with participants and last message preview.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Instagram account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const data = (await instagramManager.get(account, "direct_v2/inbox/")) as {
          inbox?: {
            threads?: Array<Record<string, unknown>>;
          };
        };

        const threads = data?.inbox?.threads ?? [];
        const conversations = threads.map((thread) => {
          const users = (thread.users as Array<Record<string, unknown>> | undefined) ?? [];
          const threadItems = thread.items as Array<Record<string, unknown>> | undefined;
          const lastItem = (thread.last_permanent_item ?? threadItems?.[0] ?? null) as Record<string, unknown> | null;

          return {
            thread_id: thread.thread_id,
            thread_title: thread.thread_title,
            participants: users.map((u) => formatUser(u)),
            last_message: lastItem
              ? {
                  text: lastItem.text ?? (lastItem.item_type === "media_share" ? "[Media]" : null),
                  timestamp: formatTimestamp(lastItem.timestamp as number | undefined),
                  item_type: lastItem.item_type,
                }
              : null,
            is_group: thread.is_group,
            muted: thread.muted,
          };
        });

        return jsonResult({ count: conversations.length, conversations });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createInstagramMessagesTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_messages",
    label: "Instagram Messages",
    description: "Get messages from a specific Instagram DM conversation. Pass the thread_id obtained from instagram_conversations.",
    parameters: Type.Object({
      thread_id: Type.String({
        description: "The DM thread ID. Get this from instagram_conversations.",
      }),
      account: Type.Optional(
        Type.String({
          description: "Instagram account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { thread_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const data = (await instagramManager.get(
          account,
          `direct_v2/threads/${encodeURIComponent(params.thread_id)}/`,
        )) as {
          thread?: {
            items?: Array<Record<string, unknown>>;
            users?: Array<Record<string, unknown>>;
            thread_title?: string;
          };
        };

        const thread = data?.thread;
        const items = thread?.items ?? [];

        const messages = items.map((item) => ({
          item_id: item.item_id,
          item_type: item.item_type,
          text: item.text ?? null,
          timestamp: formatTimestamp(item.timestamp as number | undefined),
          user_id: item.user_id,
          is_sent_by_viewer: item.is_sent_by_viewer,
        }));

        return jsonResult({
          thread_id: params.thread_id,
          thread_title: thread?.thread_title ?? null,
          count: messages.length,
          messages,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
