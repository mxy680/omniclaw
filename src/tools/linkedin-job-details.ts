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
export function createLinkedInJobDetailsTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_job_details",
    label: "LinkedIn Job Details",
    description:
      "Get full details of a job posting on LinkedIn by its job ID. Returns title, company, description, requirements, location, employment type, seniority level, and application info.",
    parameters: Type.Object({
      job_id: Type.String({
        description:
          "LinkedIn job ID (numeric). Extract from a job URN (e.g. '3912345678' from 'urn:li:fsd_jobPosting:3912345678') or from a job URL.",
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
      params: { job_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const jobId = params.job_id.replace(/\D/g, "");
        const data = (await linkedinManager.get(
          account,
          "graphql",
          undefined,
          `includeWebMetadata=true&variables=(jobPostingUrn:urn%3Ali%3Afsd_jobPosting%3A${jobId})&queryId=voyagerJobsDashJobPostings.6efab2718b4d55ca890a40a2501ef4d2`,
        )) as { included?: Array<Record<string, unknown>> };

        const postings = extractEntities(data.included, "JobPosting");
        const companies = extractEntities(data.included, "Company").concat(
          extractEntities(data.included, "Organization"),
        );
        const posting = postings[0];

        if (!posting) {
          return jsonResult({ error: `Job posting '${params.job_id}' not found.` });
        }

        const company = companies[0];

        return jsonResult({
          entityUrn: posting.entityUrn,
          title: posting.title,
          description: (posting.description as Record<string, unknown>)?.text ?? posting.description,
          company: company
            ? {
                name: company.name,
                universalName: company.universalName,
                logo: bestImageUrl(company.logo as Record<string, unknown> | undefined),
              }
            : null,
          formattedLocation: posting.formattedLocation,
          workRemoteAllowed: posting.workRemoteAllowed,
          workplaceTypes: posting.workplaceTypes,
          listedAt: posting.listedAt,
          expireAt: posting.expireAt,
          formattedEmploymentStatus: posting.formattedEmploymentStatus,
          formattedExperienceLevel: posting.formattedExperienceLevel,
          formattedIndustries: posting.formattedIndustries,
          formattedJobFunctions: posting.formattedJobFunctions,
          applyMethod: posting.applyMethod
            ? {
                companyApplyUrl: (posting.applyMethod as Record<string, unknown>).companyApplyUrl,
                easyApplyUrl: (posting.applyMethod as Record<string, unknown>).easyApplyUrl,
              }
            : null,
          applicantCount: posting.applicantCount,
          repostedJob: posting.repostedJob,
          views: posting.views,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
