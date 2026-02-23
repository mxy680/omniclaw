import { Type } from "@sinclair/typebox";
import { google, docs_v1 } from "googleapis";
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

function extractPlainText(doc: docs_v1.Schema$Document): string {
  const content = doc.body?.content ?? [];
  const parts: string[] = [];

  for (const element of content) {
    if (element.paragraph) {
      for (const pe of element.paragraph.elements ?? []) {
        if (pe.textRun?.content) {
          parts.push(pe.textRun.content);
        }
      }
    } else if (element.table) {
      for (const row of element.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          for (const cellEl of cell.content ?? []) {
            if (cellEl.paragraph) {
              for (const pe of cellEl.paragraph.elements ?? []) {
                if (pe.textRun?.content) {
                  parts.push(pe.textRun.content);
                }
              }
            }
          }
        }
      }
    }
  }

  return parts.join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDocsGetTool(clientManager: OAuthClientManager): any {
  return {
    name: "docs_get",
    label: "Docs Get",
    description:
      "Fetch a Google Doc by its ID and return its title, plain-text content, and character count.",
    parameters: Type.Object({
      document_id: Type.String({ description: "The Google Doc document ID (from its URL)." }),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(_toolCallId: string, params: { document_id: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const docs = google.docs({ version: "v1", auth: client });

      const res = await docs.documents.get({ documentId: params.document_id });
      const doc = res.data;
      const text = extractPlainText(doc);

      return jsonResult({
        id: doc.documentId ?? "",
        title: doc.title ?? "",
        content: text,
        characterCount: text.length,
        url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
      });
    },
  };
}
