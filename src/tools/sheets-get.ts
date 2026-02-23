import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";

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
  action: "Call sheets_auth_setup to authenticate.",
};

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
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { spreadsheet_id: string; range: string; account?: string },
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
