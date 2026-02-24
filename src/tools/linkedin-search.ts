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
export function createLinkedInSearchTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_search",
    label: "LinkedIn Search",
    description:
      "Search LinkedIn for people or companies. Returns matching profiles with name, headline, and location.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (e.g. 'software engineer', 'Google').",
      }),
      type: Type.Optional(
        Type.String({
          description:
            "Search type: 'people' (default) or 'companies'.",
          default: "people",
        }),
      ),
      count: Type.Optional(
        Type.Number({
          description: "Number of results (default 10, max 50).",
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
    async execute(
      _toolCallId: string,
      params: { query: string; type?: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 10, 50);
        const searchType = params.type === "companies" ? "COMPANIES" : "PEOPLE";
        const keywords = encodeURIComponent(params.query);

        const queryParams = `(keywords:${keywords},filterValues:List((id:resultType,values:List(${searchType}))))`;
        const data = (await linkedinManager.get(
          account,
          "graphql",
          undefined,
          `queryId=voyagerSearchDashClusters.05111e1b90ee7fea15bebe9f9410ced9&variables=(start:0,origin:GLOBAL_SEARCH_HEADER,query:${queryParams},count:${count})`,
        )) as { included?: Array<Record<string, unknown>> };

        if (searchType === "PEOPLE") {
          const miniProfiles = extractEntities(data.included, "MiniProfile");
          const results = miniProfiles.map((p) => ({
            firstName: p.firstName,
            lastName: p.lastName,
            headline: p.occupation,
            publicIdentifier: p.publicIdentifier,
            entityUrn: p.entityUrn,
            profilePicture: bestImageUrl(
              (p.picture as Record<string, unknown>)?.["com.linkedin.common.VectorImage"] as Record<string, unknown> | undefined ??
              p.picture as Record<string, unknown> | undefined,
            ),
          }));
          return jsonResult({ count: results.length, results });
        } else {
          const companies = extractEntities(data.included, "Company").concat(
            extractEntities(data.included, "Organization"),
          );
          const results = companies.map((c) => ({
            name: c.name,
            universalName: c.universalName,
            entityUrn: c.entityUrn,
            industry: c.industry,
            staffCount: c.staffCount,
            description: c.description,
            logo: bestImageUrl(c.logo as Record<string, unknown> | undefined),
          }));
          return jsonResult({ count: results.length, results });
        }
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInSearchJobsTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_search_jobs",
    label: "LinkedIn Search Jobs",
    description: "Search for jobs on LinkedIn. Returns job listings with title, company, location, and description.",
    parameters: Type.Object({
      keywords: Type.String({
        description: "Job search keywords (e.g. 'software engineer', 'product manager').",
      }),
      location: Type.Optional(
        Type.String({
          description: "Location filter (e.g. 'San Francisco', 'Remote').",
        }),
      ),
      count: Type.Optional(
        Type.Number({
          description: "Number of results (default 10, max 50).",
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
    async execute(
      _toolCallId: string,
      params: { keywords: string; location?: string; count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 10, 50);
        const keywords = encodeURIComponent(params.keywords);
        const location = params.location ? encodeURIComponent(params.location) : "";

        const queryParts = [`keywords:${keywords}`, `origin:JOB_SEARCH_PAGE_SEARCH_BUTTON`];
        if (location) {
          queryParts.push(`locationUnion:(geoId:${location})`);
        }

        const data = (await linkedinManager.get(
          account,
          "voyagerJobsDashJobCards",
          {
            decorationId:
              "com.linkedin.voyager.dash.deco.jobs.search.JobSearchCardsCollection-220",
            q: "jobSearch",
            count: String(count),
          },
          `query=(${queryParts.join(",")})`,
        )) as { included?: Array<Record<string, unknown>>; data?: Record<string, unknown> };

        // Prefer JobPostingCard entities with JOBS_SEARCH context (richest data)
        const searchCards = (data.included ?? []).filter(
          (item) =>
            typeof item.$type === "string" &&
            (item.$type as string).includes("JobPostingCard") &&
            typeof item.entityUrn === "string" &&
            (item.entityUrn as string).includes("JOBS_SEARCH"),
        );

        // Fall back to JobPosting entities if no search cards
        const jobPostings = searchCards.length > 0
          ? searchCards
          : extractEntities(data.included, "JobPosting");

        const jobs = jobPostings.map((job) => {
          // JobPostingCard has title as { text: "..." }, JobPosting has title as string
          const title = typeof job.title === "object" && job.title !== null
            ? (job.title as Record<string, unknown>).text
            : job.title;

          return {
            entityUrn: job.entityUrn,
            title,
            companyName:
              (job.primaryDescription as Record<string, unknown>)?.text ?? job.companyName,
            location:
              (job.secondaryDescription as Record<string, unknown>)?.text ?? job.formattedLocation,
            listDate: job.listedAt,
            workRemoteAllowed: job.workRemoteAllowed,
          };
        });

        return jsonResult({
          count: jobs.length,
          total: (data.data as Record<string, unknown> | undefined)?.paging
            ? ((data.data as Record<string, unknown>).paging as Record<string, unknown>)?.total
            : null,
          jobs,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
