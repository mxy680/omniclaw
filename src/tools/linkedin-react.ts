import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";

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

const VALID_REACTIONS = ["LIKE", "CELEBRATE", "SUPPORT", "LOVE", "INSIGHTFUL", "FUNNY"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInReactToPostTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_react_to_post",
    label: "LinkedIn React to Post",
    description:
      "React to a LinkedIn feed post. Supported reactions: LIKE, CELEBRATE, SUPPORT, LOVE, INSIGHTFUL, FUNNY. Pass the activity URN from linkedin_feed.",
    parameters: Type.Object({
      activity_urn: Type.String({
        description:
          "The activity/update URN (e.g. 'urn:li:activity:...'). Get this from linkedin_feed.",
      }),
      reaction_type: Type.Optional(
        Type.String({
          description:
            "Reaction type: LIKE (default), CELEBRATE, SUPPORT, LOVE, INSIGHTFUL, or FUNNY.",
          default: "LIKE",
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
      params: { activity_urn: string; reaction_type?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const reaction = (params.reaction_type ?? "LIKE").toUpperCase();
        if (!VALID_REACTIONS.includes(reaction as typeof VALID_REACTIONS[number])) {
          return jsonResult({
            error: `Invalid reaction type '${reaction}'. Valid types: ${VALID_REACTIONS.join(", ")}`,
          });
        }

        const encodedUrn = encodeURIComponent(params.activity_urn);

        const body = {
          reactionType: reaction,
        };

        const data = await linkedinManager.post(
          account,
          `voyagerSocialDashReactions`,
          body,
          undefined,
          `threadUrn=${encodedUrn}`,
        );

        return jsonResult({
          success: true,
          activity: params.activity_urn,
          reaction,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
