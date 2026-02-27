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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInCommentOnPostTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_comment_on_post",
    label: "LinkedIn Comment on Post",
    description:
      "Add a comment to a LinkedIn feed post. Pass the activity URN from linkedin_feed and the comment text.",
    parameters: Type.Object({
      activity_urn: Type.String({
        description:
          "The activity/update URN (e.g. 'urn:li:activity:...'). Get this from linkedin_feed.",
      }),
      text: Type.String({
        description: "The comment text.",
      }),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { activity_urn: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const body = {
          threadUrn: params.activity_urn,
          commentary: {
            text: params.text,
            attributes: [],
          },
        };

        const data = (await linkedinManager.post(
          account,
          "voyagerSocialDashComments",
          body,
        )) as Record<string, unknown>;

        // Extract comment URN from response
        const responseData = (data.data ?? data) as Record<string, unknown>;
        const commentUrn =
          responseData.entityUrn ?? responseData.urn ?? responseData.value;

        return jsonResult({
          success: true,
          activity: params.activity_urn,
          text: params.text,
          commentUrn: commentUrn ?? null,
          response: data,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
