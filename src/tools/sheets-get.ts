import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("sheets");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSheetsGetTool(clientManager: OAuthClientManager): any {
  return {
    name: "sheets_get",
    label: "Sheets Get",
    description:
      "Read cell values from a Google Sheet range. Range uses A1 notation, e.g. 'Sheet1!A1:D10' or just 'Sheet1' for the whole sheet.",
    parameters: Type.Object({
      spreadsheet_id: Type.String({ description: "The Google Sheets spreadsheet ID." }),
      range: Type.String({
        description: "A1 notation range, e.g. 'Sheet1!A1:D10' or 'Sheet1'.",
      }),
      value_render: Type.Optional(
        Type.Union(
          [
            Type.Literal("FORMATTED_VALUE"),
            Type.Literal("UNFORMATTED_VALUE"),
            Type.Literal("FORMULA"),
          ],
          {
            description:
              "How to render values. 'FORMATTED_VALUE' (default), 'FORMULA' (show formulas), 'UNFORMATTED_VALUE' (raw).",
            default: "FORMATTED_VALUE",
          },
        ),
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
      params: {
        spreadsheet_id: string;
        range: string;
        value_render?: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA";
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const sheets = google.sheets({ version: "v4", auth: client });

      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: params.spreadsheet_id,
        range: params.range,
        valueRenderOption: params.value_render ?? "FORMATTED_VALUE",
      });

      return jsonResult({
        spreadsheet_id: params.spreadsheet_id,
        range: res.data.range ?? params.range,
        values: (res.data.values ?? []) as string[][],
        rowCount: res.data.values?.length ?? 0,
        columnCount: res.data.values?.[0]?.length ?? 0,
      });
    },
  };
}
