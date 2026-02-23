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
export function createLinkedInSavedJobsTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_saved_jobs",
    label: "LinkedIn Saved Jobs",
    description:
      "List your saved/bookmarked LinkedIn job postings. Returns job title, company, location, and when the job was saved.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of saved jobs to retrieve (default 20, max 100).",
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
          "voyagerJobsDashJobCards",
          {
            decorationId:
              "com.linkedin.voyager.dash.deco.jobs.search.JobSearchCardsCollection-220",
            q: "jobSavedState",
            count: String(count),
            start: "0",
          },
        )) as { included?: Array<Record<string, unknown>>; paging?: Record<string, unknown> };

        const jobCards = (data.included ?? []).filter(
          (item) =>
            typeof item.$type === "string" &&
            ((item.$type as string).includes("JobCard") ||
              (item.$type as string).includes("JobPosting")),
        );
        const companies = extractEntities(data.included, "Company").concat(
          extractEntities(data.included, "Organization"),
        );

        // Build company lookup
        const companyMap = new Map<string, Record<string, unknown>>();
        for (const c of companies) {
          if (typeof c.entityUrn === "string") {
            companyMap.set(c.entityUrn, c);
          }
        }

        const jobs = jobCards.map((job) => ({
          entityUrn: job.entityUrn,
          title: job.jobTitle ?? job.title,
          companyName:
            (job.primaryDescription as Record<string, unknown>)?.text ?? job.companyName,
          location:
            (job.secondaryDescription as Record<string, unknown>)?.text ?? job.formattedLocation,
          savedAt: job.savedAt,
          listedAt: job.listedAt,
          workRemoteAllowed: job.workRemoteAllowed,
        }));

        return jsonResult({
          count: jobs.length,
          total: (data.paging as Record<string, unknown> | undefined)?.total ?? null,
          jobs,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
