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
export function createLinkedInCompanyTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_company",
    label: "LinkedIn Company",
    description:
      "Get detailed information about a company/organization on LinkedIn by its universal name (the part after linkedin.com/company/). Returns description, industry, size, headquarters, specialties, and more.",
    parameters: Type.Object({
      name: Type.String({
        description:
          "Company universal name (e.g. 'google' from linkedin.com/company/google).",
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
      params: { name: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const universalName = encodeURIComponent(params.name);
        const data = (await linkedinManager.get(
          account,
          "graphql",
          undefined,
          `includeWebMetadata=true&variables=(universalName:${universalName})&queryId=voyagerOrganizationDashCompanies.21ef1f6f94e8cd2c4a29aaa84acbf8a0`,
        )) as { included?: Array<Record<string, unknown>> };

        const companies = extractEntities(data.included, "Company").concat(
          extractEntities(data.included, "Organization"),
        );
        const company = companies[0];

        if (!company) {
          return jsonResult({ error: `Company '${params.name}' not found.` });
        }

        const headquarter = company.headquarter as Record<string, unknown> | undefined;
        const location = headquarter
          ? {
              city: headquarter.city,
              country: headquarter.country,
              geographicArea: headquarter.geographicArea,
              line1: headquarter.line1,
              postalCode: headquarter.postalCode,
            }
          : null;

        return jsonResult({
          name: company.name,
          universalName: company.universalName,
          entityUrn: company.entityUrn,
          tagline: company.tagline,
          description: company.description,
          industry: company.industryName ?? company.industry,
          staffCount: company.staffCount,
          staffCountRange: company.staffCountRange,
          companyType: (company.companyType as Record<string, unknown>)?.localizedName ?? company.companyType,
          foundedOn: company.foundedOn,
          specialities: company.specialities,
          websiteUrl: company.companyPageUrl ?? company.websiteUrl,
          headquarters: location,
          logo: bestImageUrl(company.logo as Record<string, unknown> | undefined),
          coverImage: bestImageUrl(company.backgroundCoverImage as Record<string, unknown> | undefined),
          followersCount: company.followingInfo
            ? (company.followingInfo as Record<string, unknown>).followerCount
            : null,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
