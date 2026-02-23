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
export function createLinkedInProfileViewsTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_profile_views",
    label: "LinkedIn Profile Views",
    description:
      "See who viewed your LinkedIn profile recently. Returns viewer names, headlines, and when they viewed your profile. Some viewers may be anonymous.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of profile views to retrieve (default 20, max 100).",
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
      params: { count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 20, 100);
        const data = (await linkedinManager.get(
          account,
          "graphql",
          undefined,
          `queryId=voyagerIdentityDashProfileViewers.fac978c10a57ef218e1498e3690ee951&variables=(start:0,count:${count})`,
        )) as { included?: Array<Record<string, unknown>>; data?: Record<string, unknown> };

        const viewers = extractEntities(data.included, "ProfileViewer").concat(
          extractEntities(data.included, "ProfileView"),
        );
        const miniProfiles = extractEntities(data.included, "MiniProfile");

        // Build profile lookup
        const profileMap = new Map<string, Record<string, unknown>>();
        for (const p of miniProfiles) {
          if (typeof p.entityUrn === "string") {
            profileMap.set(p.entityUrn, p);
          }
        }

        const result = viewers.map((viewer) => {
          const viewerUrn = (viewer["*viewer"] ?? viewer["*viewerMiniProfile"] ?? viewer.viewer) as string | undefined;
          const viewerProfile = viewerUrn ? profileMap.get(viewerUrn) : undefined;
          const isAnonymous = !viewerProfile && !viewerUrn;

          return {
            entityUrn: viewer.entityUrn,
            viewedAt: viewer.viewedAt ?? viewer.created,
            anonymous: isAnonymous,
            viewer: viewerProfile
              ? {
                  firstName: viewerProfile.firstName,
                  lastName: viewerProfile.lastName,
                  headline: viewerProfile.occupation,
                  publicIdentifier: viewerProfile.publicIdentifier,
                  profilePicture: bestImageUrl(
                    (viewerProfile.picture as Record<string, unknown>)?.["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined ??
                    viewerProfile.picture as Record<string, unknown> | undefined,
                  ),
                }
              : isAnonymous
                ? { note: "Anonymous viewer" }
                : { urn: viewerUrn },
          };
        });

        // Also try to get total view count from data
        const viewCount = (data.data as Record<string, unknown> | undefined)?.total ??
          (data.data as Record<string, unknown> | undefined)?.viewCount ?? null;

        return jsonResult({
          count: result.length,
          totalViews: viewCount,
          viewers: result,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
