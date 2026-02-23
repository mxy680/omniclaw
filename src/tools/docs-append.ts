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
export function createDocsAppendTool(clientManager: OAuthClientManager): any {
  return {
    name: "docs_append",
    label: "Docs Append",
    description:
      "Append text to the end of an existing Google Doc.",
    parameters: Type.Object({
      document_id: Type.String({ description: "The Google Doc document ID." }),
      text: Type.String({ description: "Text to append to the end of the document." }),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { document_id: string; text: string; account?: string }
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const docs = google.docs({ version: "v1", auth: client });

      // Get current end index to insert just before the final newline
      const doc = await docs.documents.get({ documentId: params.document_id });
      const endIndex = doc.data.body?.content?.at(-1)?.endIndex ?? 1;
      const insertIndex = Math.max(1, endIndex - 1);

      await docs.documents.batchUpdate({
        documentId: params.document_id,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: insertIndex },
                text: params.text,
              },
            },
          ],
        },
      });

      return jsonResult({
        success: true,
        document_id: params.document_id,
        inserted_at: insertIndex,
        characters_added: params.text.length,
      });
    },
  };
}
