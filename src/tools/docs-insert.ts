import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("docs");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDocsInsertTool(clientManager: OAuthClientManager): any {
  return {
    name: "docs_insert",
    label: "Google Docs Insert Text",
    description:
      "Insert text at a specific character position in a Google Doc. Use docs_get to determine the document length.",
    parameters: Type.Object({
      document_id: Type.String({ description: "The Google Doc document ID." }),
      text: Type.String({ description: "Text to insert." }),
      index: Type.Number({ description: "Character position to insert at (1-based)." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { document_id: string; text: string; index: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);

      const client = clientManager.getClient(account);
      const docs = google.docs({ version: "v1", auth: client });

      await docs.documents.batchUpdate({
        documentId: params.document_id,
        requestBody: {
          requests: [{ insertText: { location: { index: params.index }, text: params.text } }],
        },
      });

      return jsonResult({
        success: true,
        document_id: params.document_id,
        inserted_at: params.index,
        characters_added: params.text.length,
      });
    },
  };
}
