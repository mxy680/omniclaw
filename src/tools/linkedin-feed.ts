import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";
import { extractEntities, bestImageUrl } from "./linkedin-utils.js";

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
  action: "Call linkedin_auth_setup to authenticate with LinkedIn first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInFeedTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_feed",
    label: "LinkedIn Feed",
    description: "Get posts from the user's LinkedIn feed. Returns recent feed updates with author info, text content, and engagement metrics.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of posts to retrieve (default 10, max 50).",
          default: 10,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { count?: number; account?: string }) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 10, 50);
        const data = (await linkedinManager.get(
          account,
          "graphql",
          undefined,
          `queryId=voyagerFeedDashMainFeed.923020905727c01516495a0ac90bb475&variables=(start:0,count:${count},sortOrder:RELEVANCE)`,
        )) as { included?: Array<Record<string, unknown>> };

        const updates = extractEntities(data.included, "Update");
        const miniProfiles = extractEntities(data.included, "MiniProfile");
        const commentaries = extractEntities(data.included, "Commentary");

        // Build a profile lookup by URN
        const profileMap = new Map<string, Record<string, unknown>>();
        for (const p of miniProfiles) {
          if (typeof p.entityUrn === "string") {
            profileMap.set(p.entityUrn, p);
          }
        }

        const posts = updates.slice(0, count).map((update) => {
          // Extract text content from commentary
          const actorUrn = update.actor as string | undefined;
          const actor = actorUrn ? profileMap.get(actorUrn) : undefined;

          // Try to find associated commentary
          const commentary = commentaries.find((c) => {
            const urn = c.entityUrn as string | undefined;
            return urn && update.entityUrn && typeof update.entityUrn === "string" &&
              urn.includes(update.entityUrn as string);
          });

          const textContent =
            (update.commentary as Record<string, unknown>)?.text ??
            (commentary as Record<string, unknown> | undefined)?.text ??
            update.text;

          return {
            entityUrn: update.entityUrn,
            text: textContent,
            author: actor
              ? {
                  name: `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim(),
                  headline: actor.occupation,
                  publicIdentifier: actor.publicIdentifier,
                }
              : null,
            numLikes: update.numLikes ?? update.totalSocialActivityCounts
              ? ((update.totalSocialActivityCounts as Record<string, unknown>)?.numLikes ?? 0)
              : 0,
            numComments: update.numComments ?? update.totalSocialActivityCounts
              ? ((update.totalSocialActivityCounts as Record<string, unknown>)?.numComments ?? 0)
              : 0,
          };
        });

        return jsonResult({ count: posts.length, posts });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
