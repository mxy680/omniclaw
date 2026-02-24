import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { formatTimestamp } from "./instagram-utils.js";

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
export function createInstagramNotificationsTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_notifications",
    label: "Instagram Notifications",
    description: "List your Instagram activity notifications (likes, comments, follows, mentions).",
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
        let data: {
          old_stories?: Array<Record<string, unknown>>;
          new_stories?: Array<Record<string, unknown>>;
          counts?: Record<string, unknown>;
        } = {};

        try {
          data = (await instagramManager.get(account, "news/inbox/")) as typeof data;
        } catch (inboxErr) {
          const msg = inboxErr instanceof Error ? inboxErr.message : String(inboxErr);
          // news/inbox/ is known to return 500 on some accounts; return a graceful error
          return jsonResult({
            error: `Notifications endpoint unavailable: ${msg}`,
            note: "The Instagram notifications API (news/inbox/) is currently returning an error for this account. This is a known Instagram API limitation.",
          });
        }

        const newStories = data?.new_stories ?? [];
        const oldStories = data?.old_stories ?? [];
        const all = [...newStories, ...oldStories];

        const notifications = all.map((story) => {
          const args = story.args as Record<string, unknown> | undefined;
          return {
            type: story.type ?? story.story_type,
            text: args?.text ?? story.text ?? null,
            timestamp: formatTimestamp((args?.timestamp as number | undefined) ?? (story.timestamp as number | undefined)),
            profile_image: args?.profile_image ?? null,
            media_preview: (args?.media as Array<Record<string, unknown>> | undefined)?.[0]?.image ?? null,
          };
        });

        return jsonResult({
          count: notifications.length,
          notifications,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
