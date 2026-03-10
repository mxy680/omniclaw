import { Type } from "@sinclair/typebox";
import type { LinkedinClientManager } from "../auth/linkedin-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("linkedin");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinPostListTool(manager: LinkedinClientManager): any {
  return {
    name: "linkedin_post_list",
    label: "LinkedIn Post List",
    description: "Get feed posts from the authenticated user's LinkedIn feed.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({ description: "Number of posts to return.", default: 10 }),
      ),
      start: Type.Optional(
        Type.Number({ description: "Pagination start index.", default: 0 }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { count?: number; start?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const count = params.count ?? 10;
        const start = params.start ?? 0;
        const result = await client.request<Record<string, unknown>>({
          path: `/feed/updatesV2?count=${count}&start=${start}&q=chronFeed`,
          headers: {
            Accept: "application/vnd.linkedin.normalized+json+2.1",
          },
        });
        return jsonResult(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call linkedin_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

const SHARES_QUERY_ID = "voyagerContentcreationDashShares.279996efa5064c01775d5aff003d9377";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinPostCreateTool(manager: LinkedinClientManager): any {
  return {
    name: "linkedin_post_create",
    label: "LinkedIn Post Create",
    description: "Create a new text post on LinkedIn.",
    parameters: Type.Object({
      text: Type.String({ description: "The post text content." }),
      visibility: Type.Optional(
        Type.String({
          description: "Post visibility: ANYONE (public) or CONNECTIONS.",
          default: "ANYONE",
        }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { text: string; visibility?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const visibilityType = params.visibility === "CONNECTIONS" ? "CONNECTIONS" : "ANYONE";
        const postData = {
          allowedCommentersScope: "ALL",
          intendedShareLifeCycleState: "PUBLISHED",
          origin: "FEED",
          visibilityDataUnion: { visibilityType },
          commentary: { text: params.text, attributesV2: [] },
        };
        const result = await client.request<Record<string, unknown>>({
          method: "POST",
          path: `/graphql?action=execute&queryId=${SHARES_QUERY_ID}`,
          body: {
            variables: { post: postData },
            queryId: SHARES_QUERY_ID,
            includeWebMetadata: true,
          },
        });
        return jsonResult(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call linkedin_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinPostLikeTool(manager: LinkedinClientManager): any {
  return {
    name: "linkedin_post_like",
    label: "LinkedIn Post Like",
    description: "Like a post on LinkedIn.",
    parameters: Type.Object({
      urn: Type.String({
        description: "The URN of the post to like (e.g., urn:li:activity:1234567890).",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { urn: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const encodedUrn = encodeURIComponent(params.urn);
        const result = await client.request<Record<string, unknown>>({
          method: "POST",
          path: `/voyagerSocialDashReactions?threadUrn=${encodedUrn}`,
          body: {
            reactionType: "LIKE",
          },
        });
        return jsonResult({ status: "liked", urn: params.urn, ...result });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call linkedin_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinPostCommentTool(manager: LinkedinClientManager): any {
  return {
    name: "linkedin_post_comment",
    label: "LinkedIn Post Comment",
    description: "Add a comment to a LinkedIn post.",
    parameters: Type.Object({
      urn: Type.String({
        description: "The URN of the post to comment on (e.g., urn:li:activity:1234567890).",
      }),
      text: Type.String({ description: "The comment text." }),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { urn: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const encodedUrn = encodeURIComponent(params.urn);
        const result = await client.request<Record<string, unknown>>({
          method: "POST",
          path: `/feed/dash/comments?threadUrn=${encodedUrn}`,
          body: {
            commentary: params.text,
          },
        });
        return jsonResult({ status: "commented", urn: params.urn, ...result });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Call linkedin_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
