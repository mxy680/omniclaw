import { Type } from "@sinclair/typebox";
import type { LinkedinSessionClient } from "../auth/linkedin-session-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("linkedin");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedinSearchPeopleTool(client: LinkedinSessionClient): any {
  return {
    name: "linkedin_search_people",
    label: "LinkedIn Search People",
    description: "Search for people on LinkedIn by keyword.",
    parameters: Type.Object({
      keywords: Type.String({ description: "Search keywords (name, title, company, etc.)." }),
      start: Type.Optional(
        Type.Number({ description: "Pagination start index.", default: 0 }),
      ),
      count: Type.Optional(
        Type.Number({ description: "Number of results to return.", default: 10 }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { keywords: string; start?: number; count?: number; account?: string },
    ) {
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const start = params.start ?? 0;
        const count = params.count ?? 10;
        const keywords = encodeURIComponent(params.keywords);
        const result = await client.request<Record<string, unknown>>({
          path: `/graphql?variables=(start:${start},origin:GLOBAL_SEARCH_HEADER,query:(keywords:${keywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE))),includeFiltersInResponse:false))&queryId=voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0`,
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
