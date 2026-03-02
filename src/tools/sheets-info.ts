import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("sheets");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSheetsInfoTool(clientManager: OAuthClientManager): any {
  return {
    name: "sheets_info",
    label: "Google Sheets Info",
    description:
      "Get spreadsheet metadata: title, locale, and list of sheets (tabs) with their properties.",
    parameters: Type.Object({
      spreadsheet_id: Type.String({ description: "The Google Sheets spreadsheet ID." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { spreadsheet_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);

      const client = clientManager.getClient(account);
      const sheets = google.sheets({ version: "v4", auth: client });

      const res = await sheets.spreadsheets.get({
        spreadsheetId: params.spreadsheet_id,
        fields: "spreadsheetId,properties,sheets.properties",
      });

      const props = res.data.properties;
      return jsonResult({
        id: res.data.spreadsheetId ?? "",
        title: props?.title ?? "",
        locale: props?.locale ?? "",
        timeZone: props?.timeZone ?? "",
        sheets: (res.data.sheets ?? []).map((s) => ({
          sheetId: s.properties?.sheetId ?? 0,
          title: s.properties?.title ?? "",
          index: s.properties?.index ?? 0,
          rowCount: s.properties?.gridProperties?.rowCount ?? 0,
          columnCount: s.properties?.gridProperties?.columnCount ?? 0,
        })),
      });
    },
  };
}
