import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("sheets");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSheetsCreateTool(clientManager: OAuthClientManager): any {
  return {
    name: "sheets_create",
    label: "Sheets Create",
    description: "Create a new Google Sheets spreadsheet with a given title.",
    parameters: Type.Object({
      title: Type.String({ description: "Title of the new spreadsheet." }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { title: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const sheets = google.sheets({ version: "v4", auth: client });

      const res = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: params.title },
        },
      });

      const id = res.data.spreadsheetId ?? "";
      const sheetNames = (res.data.sheets ?? []).map((s) => s.properties?.title ?? "Sheet1");

      return jsonResult({
        success: true,
        id,
        title: res.data.properties?.title ?? params.title,
        sheets: sheetNames,
        url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
      });
    },
  };
}
