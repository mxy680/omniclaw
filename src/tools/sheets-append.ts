import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("sheets");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSheetsAppendTool(clientManager: OAuthClientManager): any {
  return {
    name: "sheets_append",
    label: "Sheets Append",
    description: "Append rows of data after the last row with content in a Google Sheet.",
    parameters: Type.Object({
      spreadsheet_id: Type.String({ description: "The Google Sheets spreadsheet ID." }),
      sheet: Type.Optional(
        Type.String({
          description: "Sheet name to append to. Defaults to 'Sheet1'.",
          default: "Sheet1",
        }),
      ),
      values: Type.Array(Type.Array(Type.String(), { description: "A row of cell values." }), {
        description: "2D array of rows to append.",
      }),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { spreadsheet_id: string; sheet?: string; values: string[][]; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const sheets = google.sheets({ version: "v4", auth: client });

      const range = params.sheet ?? "Sheet1";

      const res = await sheets.spreadsheets.values.append({
        spreadsheetId: params.spreadsheet_id,
        range,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: params.values },
      });

      return jsonResult({
        success: true,
        spreadsheet_id: params.spreadsheet_id,
        updated_range: res.data.updates?.updatedRange ?? range,
        appended_rows: res.data.updates?.updatedRows ?? 0,
      });
    },
  };
}
