import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("sheets");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSheetsAddSheetTool(clientManager: OAuthClientManager): any {
  return {
    name: "sheets_add_sheet",
    label: "Google Sheets Add Sheet",
    description: "Add a new sheet (tab) to a spreadsheet.",
    parameters: Type.Object({
      spreadsheet_id: Type.String({ description: "The spreadsheet ID." }),
      title: Type.String({ description: "Name for the new sheet tab." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { spreadsheet_id: string; title: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);
      const client = clientManager.getClient(account);
      const sheets = google.sheets({ version: "v4", auth: client });
      const res = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: params.spreadsheet_id,
        requestBody: { requests: [{ addSheet: { properties: { title: params.title } } }] },
      });
      const added = res.data.replies?.[0]?.addSheet?.properties;
      return jsonResult({
        success: true,
        sheetId: added?.sheetId ?? 0,
        title: added?.title ?? params.title,
      });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSheetsDeleteSheetTool(clientManager: OAuthClientManager): any {
  return {
    name: "sheets_delete_sheet",
    label: "Google Sheets Delete Sheet",
    description:
      "Delete a sheet (tab) from a spreadsheet by its sheet ID.",
    parameters: Type.Object({
      spreadsheet_id: Type.String({ description: "The spreadsheet ID." }),
      sheet_id: Type.Number({
        description: "The numeric sheet ID to delete (use sheets_info to find it).",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { spreadsheet_id: string; sheet_id: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);
      const client = clientManager.getClient(account);
      const sheets = google.sheets({ version: "v4", auth: client });
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: params.spreadsheet_id,
        requestBody: { requests: [{ deleteSheet: { sheetId: params.sheet_id } }] },
      });
      return jsonResult({ success: true, sheet_id: params.sheet_id });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSheetsRenameSheetTool(clientManager: OAuthClientManager): any {
  return {
    name: "sheets_rename_sheet",
    label: "Google Sheets Rename Sheet",
    description: "Rename a sheet (tab) in a spreadsheet.",
    parameters: Type.Object({
      spreadsheet_id: Type.String({ description: "The spreadsheet ID." }),
      sheet_id: Type.Number({ description: "The numeric sheet ID to rename." }),
      title: Type.String({ description: "New name for the sheet." }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { spreadsheet_id: string; sheet_id: number; title: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);
      const client = clientManager.getClient(account);
      const sheets = google.sheets({ version: "v4", auth: client });
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: params.spreadsheet_id,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: params.sheet_id, title: params.title },
                fields: "title",
              },
            },
          ],
        },
      });
      return jsonResult({ success: true, sheet_id: params.sheet_id, title: params.title });
    },
  };
}
