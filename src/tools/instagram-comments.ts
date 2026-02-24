import { Type } from "@sinclair/typebox";
import type { InstagramClientManager } from "../auth/instagram-client-manager.js";
import { formatTimestamp, formatUser, parseShortcode, shortcodeToMediaId } from "./instagram-utils.js";

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
export function createInstagramPostCommentsTool(instagramManager: InstagramClientManager): any {
  return {
    name: "instagram_post_comments",
    label: "Instagram Post Comments",
    description: "Get comments on a specific Instagram post by shortcode or URL.",
    parameters: Type.Object({
      shortcode: Type.String({
        description: "Post shortcode or full Instagram URL (e.g. 'CxYz123' or 'https://www.instagram.com/p/CxYz123/').",
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
      params: { shortcode: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!instagramManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const shortcode = parseShortcode(params.shortcode);
        const mediaId = shortcodeToMediaId(shortcode);

        const data = (await instagramManager.get(
          account,
          `media/${mediaId}/comments/?can_support_threading=true`,
        )) as {
          comments?: Array<Record<string, unknown>>;
        };

        const rawComments = data?.comments ?? [];
        const comments = rawComments.map((c) => ({
          pk: c.pk,
          text: c.text,
          created_at: formatTimestamp(c.created_at as number | undefined),
          like_count: c.comment_like_count ?? c.like_count,
          user: formatUser(c.user as Record<string, unknown> | undefined),
          child_comment_count: c.child_comment_count ?? 0,
        }));

        return jsonResult({ shortcode, count: comments.length, comments });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
