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
export function createLinkedInPostCommentsTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_post_comments",
    label: "LinkedIn Post Comments",
    description:
      "Get comments on a specific LinkedIn feed post. Pass the activity URN from linkedin_feed results.",
    parameters: Type.Object({
      activity_urn: Type.String({
        description:
          "The activity/update URN (e.g. 'urn:li:activity:7123456789'). Get this from linkedin_feed results.",
      }),
      count: Type.Optional(
        Type.Number({
          description: "Number of comments to retrieve (default 20, max 100).",
          default: 20,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { activity_urn: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 20, 100);
        const activityUrn = encodeURIComponent(params.activity_urn);

        const data = (await linkedinManager.get(
          account,
          "graphql",
          undefined,
          `queryId=voyagerSocialDashComments.536c0e229c96dca3bfbab11afd0b0de1&variables=(socialDetailUrn:${activityUrn},start:0,count:${count},sortOrder:RELEVANCE)`,
        )) as { included?: Array<Record<string, unknown>> };

        const comments = extractEntities(data.included, "Comment");
        const miniProfiles = extractEntities(data.included, "MiniProfile");

        // Build profile lookup
        const profileMap = new Map<string, Record<string, unknown>>();
        for (const p of miniProfiles) {
          if (typeof p.entityUrn === "string") {
            profileMap.set(p.entityUrn, p);
          }
        }

        const result = comments.map((comment) => {
          const authorUrn = (comment["*commenter"] ?? comment.commenter ?? comment.actor) as string | undefined;
          const authorProfile = authorUrn ? profileMap.get(authorUrn) : undefined;

          return {
            entityUrn: comment.entityUrn,
            text: (comment.commentary as Record<string, unknown>)?.text ??
              (comment.comment as Record<string, unknown>)?.text ??
              comment.text,
            author: authorProfile
              ? {
                  name: `${authorProfile.firstName ?? ""} ${authorProfile.lastName ?? ""}`.trim(),
                  headline: authorProfile.occupation,
                  publicIdentifier: authorProfile.publicIdentifier,
                  profilePicture: bestImageUrl(
                    (authorProfile.picture as Record<string, unknown>)?.["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined ??
                    authorProfile.picture as Record<string, unknown> | undefined,
                  ),
                }
              : { urn: authorUrn },
            createdAt: comment.createdAt ?? comment.created,
            numLikes: comment.numLikes ?? 0,
            numReplies: comment.numReplies ?? 0,
          };
        });

        return jsonResult({ count: result.length, comments: result });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
