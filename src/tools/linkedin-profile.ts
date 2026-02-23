import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";
import { extractEntities, bestImageUrl, formatDate, buildEntityMap } from "./linkedin-utils.js";

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
export function createLinkedInProfileTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_profile",
    label: "LinkedIn Profile",
    description: "Get the authenticated user's LinkedIn profile including name, headline, and profile picture.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const data = (await linkedinManager.get(account, "me")) as {
          included?: Array<Record<string, unknown>>;
        };
        const profiles = extractEntities(data.included, "MiniProfile");
        if (profiles.length === 0) {
          return jsonResult({ error: "No profile data found in response." });
        }
        const profile = profiles[0];
        return jsonResult({
          firstName: profile.firstName,
          lastName: profile.lastName,
          headline: profile.occupation,
          publicIdentifier: profile.publicIdentifier,
          entityUrn: profile.entityUrn,
          profilePicture: bestImageUrl(
            (profile.picture as Record<string, unknown>)?.["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined ??
            profile.picture as Record<string, unknown> | undefined,
          ),
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInGetProfileTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_get_profile",
    label: "LinkedIn Get Profile",
    description:
      "Get any LinkedIn user's full profile by their public identifier (the part after linkedin.com/in/). Returns name, headline, summary, experience, education, and skills.",
    parameters: Type.Object({
      id: Type.String({
        description: "LinkedIn public identifier (e.g. 'johndoe' from linkedin.com/in/johndoe).",
      }),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const vanityName = encodeURIComponent(params.id);
        const data = (await linkedinManager.get(
          account,
          "graphql",
          undefined,
          `includeWebMetadata=true&variables=(vanityName:${vanityName})&queryId=voyagerIdentityDashProfiles.34ead06db82a2cc9a778fac97f69ad6a`,
        )) as { included?: Array<Record<string, unknown>> };

        const entityMap = buildEntityMap(data.included);
        const profiles = extractEntities(data.included, "Profile");
        const positions = extractEntities(data.included, "Position");
        const educations = extractEntities(data.included, "Education");
        const skills = extractEntities(data.included, "Skill");

        const profile = profiles[0] ?? {};

        return jsonResult({
          firstName: profile.firstName,
          lastName: profile.lastName,
          headline: profile.headline,
          summary: profile.summary,
          industryName: profile.industryName,
          locationName: profile.locationName,
          publicIdentifier: profile.publicIdentifier,
          profilePicture: bestImageUrl(
            profile.profilePicture as Record<string, unknown> | undefined,
          ),
          experience: positions.map((pos) => ({
            title: pos.title,
            companyName: pos.companyName,
            locationName: pos.locationName,
            description: pos.description,
            startDate: formatDate(pos.dateRange
              ? (pos.dateRange as Record<string, unknown>).start as Record<string, unknown>
              : pos.timePeriod
                ? (pos.timePeriod as Record<string, unknown>).startDate as Record<string, unknown>
                : null),
            endDate: formatDate(pos.dateRange
              ? (pos.dateRange as Record<string, unknown>).end as Record<string, unknown>
              : pos.timePeriod
                ? (pos.timePeriod as Record<string, unknown>).endDate as Record<string, unknown>
                : null),
          })),
          education: educations.map((edu) => ({
            schoolName: edu.schoolName,
            degreeName: edu.degreeName,
            fieldOfStudy: edu.fieldOfStudy,
            startDate: formatDate(edu.dateRange
              ? (edu.dateRange as Record<string, unknown>).start as Record<string, unknown>
              : edu.timePeriod
                ? (edu.timePeriod as Record<string, unknown>).startDate as Record<string, unknown>
                : null),
            endDate: formatDate(edu.dateRange
              ? (edu.dateRange as Record<string, unknown>).end as Record<string, unknown>
              : edu.timePeriod
                ? (edu.timePeriod as Record<string, unknown>).endDate as Record<string, unknown>
                : null),
          })),
          skills: skills.map((s) => s.name),
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
