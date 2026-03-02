import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("sheets");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSheetsUpdateTool(clientManager: OAuthClientManager): any {
  return {
    name: "sheets_update",
    label: "Sheets Update",
    description:
      "Write values to a range in a Google Sheet. Values is a 2D array of rows and columns. Existing cell content in the range is overwritten.",
    parameters: Type.Object({
      spreadsheet_id: Type.String({ description: "The Google Sheets spreadsheet ID." }),
      range: Type.String({
        description: "A1 notation range to write to, e.g. 'Sheet1!A1'.",
      }),
      values: Type.Array(Type.Array(Type.String(), { description: "A row of cell values." }), {
        description: "2D array of values: outer array is rows, inner array is columns.",
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
      params: { spreadsheet_id: string; range: string; values: string[][]; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const sheets = google.sheets({ version: "v4", auth: client });

      const res = await sheets.spreadsheets.values.update({
        spreadsheetId: params.spreadsheet_id,
        range: params.range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: params.values },
      });

      return jsonResult({
        success: true,
        spreadsheet_id: params.spreadsheet_id,
        updated_range: res.data.updatedRange ?? params.range,
        updated_rows: res.data.updatedRows ?? 0,
        updated_columns: res.data.updatedColumns ?? 0,
        updated_cells: res.data.updatedCells ?? 0,
      });
    },
  };
}
