import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager";

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
  action: "Call docs_auth_setup to authenticate.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDocsReplaceTextTool(clientManager: OAuthClientManager): any {
  return {
    name: "docs_replace_text",
    label: "Docs Replace Text",
    description:
      "Find and replace all occurrences of a text string in a Google Doc. Useful for filling in templates or making bulk text changes.",
    parameters: Type.Object({
      document_id: Type.String({ description: "The Google Doc document ID." }),
      find: Type.String({ description: "The text to search for." }),
      replace: Type.String({ description: "The text to replace it with." }),
      match_case: Type.Optional(
        Type.Boolean({
          description: "Whether the search is case-sensitive. Defaults to false.",
          default: false,
        })
      ),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        document_id: string;
        find: string;
        replace: string;
        match_case?: boolean;
        account?: string;
      }
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const docs = google.docs({ version: "v1", auth: client });

      const res = await docs.documents.batchUpdate({
        documentId: params.document_id,
        requestBody: {
          requests: [
            {
              replaceAllText: {
                containsText: {
                  text: params.find,
                  matchCase: params.match_case ?? false,
                },
                replaceText: params.replace,
              },
            },
          ],
        },
      });

      const occurrences =
        res.data.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0;

      return jsonResult({
        success: true,
        document_id: params.document_id,
        occurrences_replaced: occurrences,
      });
    },
  };
}
