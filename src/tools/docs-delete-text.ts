import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("docs");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDocsDeleteTextTool(clientManager: OAuthClientManager): any {
  return {
    name: "docs_delete_text",
    label: "Google Docs Delete Text",
    description:
      "Delete text in a Google Doc between start and end character indices.",
    parameters: Type.Object({
      document_id: Type.String({ description: "The Google Doc document ID." }),
      start_index: Type.Number({ description: "Start character index (inclusive)." }),
      end_index: Type.Number({ description: "End character index (exclusive)." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { document_id: string; start_index: number; end_index: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);

      const client = clientManager.getClient(account);
      const docs = google.docs({ version: "v1", auth: client });

      await docs.documents.batchUpdate({
        documentId: params.document_id,
        requestBody: {
          requests: [
            {
              deleteContentRange: {
                range: {
                  startIndex: params.start_index,
                  endIndex: params.end_index,
                  segmentId: "",
                },
              },
            },
          ],
        },
      });

      return jsonResult({
        success: true,
        document_id: params.document_id,
        deleted_range: { start: params.start_index, end: params.end_index },
      });
    },
  };
}
