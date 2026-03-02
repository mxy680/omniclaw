import { Type } from "@sinclair/typebox";
import { google, docs_v1 } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("docs");

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
function extractMarkdown(doc: any): string {
  const parts: string[] = [];
  for (const el of doc.body?.content ?? []) {
    if (el.paragraph) {
      const style = el.paragraph.paragraphStyle?.namedStyleType ?? "";
      const headingLevel = style.match(/^HEADING_(\d)$/)?.[1];
      const isList = !!el.paragraph.bullet;

      let lineText = "";
      for (const te of el.paragraph.elements ?? []) {
        if (te.textRun) {
          const text = te.textRun.content ?? "";
          const url = te.textRun.textStyle?.link?.url;
          if (url && text.trim()) {
            lineText += `[${text.replace(/\n$/, "")}](${url})`;
          } else {
            lineText += text;
          }
        }
      }

      // Remove trailing newline from paragraph
      lineText = lineText.replace(/\n$/, "");
      if (!lineText) continue;

      if (headingLevel) {
        parts.push("#".repeat(Number(headingLevel)) + " " + lineText);
      } else if (isList) {
        parts.push("- " + lineText);
      } else {
        parts.push(lineText);
      }
    } else if (el.table) {
      for (const row of el.table.tableRows ?? []) {
        const cells: string[] = [];
        for (const cell of row.tableCells ?? []) {
          let cellText = "";
          for (const cellEl of cell.content ?? []) {
            for (const te of cellEl.paragraph?.elements ?? []) {
              if (te.textRun) cellText += te.textRun.content ?? "";
            }
          }
          cells.push(cellText.replace(/\n/g, " ").trim());
        }
        parts.push("| " + cells.join(" | ") + " |");
      }
    }
  }
  return parts.join("\n");
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
      format: Type.Optional(
        Type.String({
          description:
            "Output format: 'plain' (default) or 'markdown'. Markdown preserves headings, lists, and links.",
          default: "plain",
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
      params: { document_id: string; format?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const docs = google.docs({ version: "v1", auth: client });

      const res = await docs.documents.get({ documentId: params.document_id });
      const doc = res.data;
      const text =
        params.format === "markdown" ? extractMarkdown(doc) : extractPlainText(doc);

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
