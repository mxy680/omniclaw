import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";

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
  action: "Call slides_auth_setup to authenticate.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlidesReplaceTextTool(clientManager: OAuthClientManager): any {
  return {
    name: "slides_replace_text",
    label: "Slides Replace Text",
    description:
      "Find and replace all occurrences of a text string across all slides in a Google Slides presentation. Useful for filling in templates.",
    parameters: Type.Object({
      presentation_id: Type.String({ description: "The Google Slides presentation ID." }),
      find: Type.String({ description: "The text to search for." }),
      replace: Type.String({ description: "The text to replace it with." }),
      match_case: Type.Optional(
        Type.Boolean({
          description: "Whether the search is case-sensitive. Defaults to false.",
          default: false,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        presentation_id: string;
        find: string;
        replace: string;
        match_case?: boolean;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const slides = google.slides({ version: "v1", auth: client });

      const res = await slides.presentations.batchUpdate({
        presentationId: params.presentation_id,
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

      const occurrences = res.data.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0;

      return jsonResult({
        success: true,
        presentation_id: params.presentation_id,
        occurrences_replaced: occurrences,
      });
    },
  };
}
