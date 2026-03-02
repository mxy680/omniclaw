import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("docs");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDocsCreateTool(clientManager: OAuthClientManager): any {
  return {
    name: "docs_create",
    label: "Docs Create",
    description: "Create a new Google Doc with a given title and optional initial text content.",
    parameters: Type.Object({
      title: Type.String({ description: "Title of the new document." }),
      content: Type.Optional(
        Type.String({ description: "Initial text content to insert into the document." }),
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
      params: { title: string; content?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const docs = google.docs({ version: "v1", auth: client });

      const created = await docs.documents.create({
        requestBody: { title: params.title },
      });

      const docId = created.data.documentId ?? "";

      if (params.content) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: params.content,
                },
              },
            ],
          },
        });
      }

      return jsonResult({
        success: true,
        id: docId,
        title: created.data.title ?? params.title,
        url: `https://docs.google.com/document/d/${docId}/edit`,
      });
    },
  };
}
