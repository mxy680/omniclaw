/**
 * Integration tests — hit the real Google Sheets API.
 * Run with: RUN_WRITE_TESTS=1 CLIENT_SECRET_PATH="..." pnpm vitest run tests/integration/sheets.test.ts
 */

import { existsSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OAuthClientManager } from "../../src/auth/oauth-client-manager.js";
import { TokenStore } from "../../src/auth/token-store.js";
import { createDriveDeleteTool } from "../../src/tools/drive-delete.js";
import { createSheetsAppendTool } from "../../src/tools/sheets-append.js";
import { createSheetsClearTool } from "../../src/tools/sheets-clear.js";
import { createSheetsCreateTool } from "../../src/tools/sheets-create.js";
import { createSheetsExportTool } from "../../src/tools/sheets-download.js";
import { createSheetsGetTool } from "../../src/tools/sheets-get.js";
import { createSheetsUpdateTool } from "../../src/tools/sheets-update.js";

const CLIENT_SECRET_PATH =
  process.env.CLIENT_SECRET_PATH ??
  join(homedir(), ".openclaw", "client_secret.json");

const TOKENS_PATH = process.env.TOKENS_PATH ?? join(homedir(), ".openclaw", "omniclaw-tokens.json");

const ACCOUNT = process.env.GMAIL_ACCOUNT ?? "default";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

const credentialsExist = existsSync(CLIENT_SECRET_PATH) && existsSync(TOKENS_PATH);

const SHEETS_SAVE_DIR = join(tmpdir(), `omniclaw-sheets-test-${Date.now()}`);

if (!credentialsExist) {
  console.warn("\n[integration] Skipping: credentials not found.\n");
}

let clientManager: OAuthClientManager;
let createdSpreadsheetId: string;

describe.skipIf(!credentialsExist)("Google Sheets API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    const tokenStore = new TokenStore(TOKENS_PATH);
    clientManager = new OAuthClientManager(CLIENT_SECRET_PATH, 9753, tokenStore);
  });

  afterAll(() => {
    if (existsSync(SHEETS_SAVE_DIR)) {
      for (const file of readdirSync(SHEETS_SAVE_DIR)) {
        unlinkSync(join(SHEETS_SAVE_DIR, file));
      }
      rmdirSync(SHEETS_SAVE_DIR);
    }
  });

  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    it("sheets_create — creates a spreadsheet", async () => {
      const tool = createSheetsCreateTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        title: "[omniclaw integration test] sheets_create",
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.id).toBe("string");
      expect(result.details.id.length).toBeGreaterThan(0);
      expect(result.details.url).toContain(result.details.id);
      expect(Array.isArray(result.details.sheets)).toBe(true);

      createdSpreadsheetId = result.details.id;
    });

    it("sheets_update — writes a header row", async () => {
      expect(createdSpreadsheetId).toBeTruthy();

      const tool = createSheetsUpdateTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        spreadsheet_id: createdSpreadsheetId,
        range: "Sheet1!A1",
        values: [["Name", "Email", "Score"]],
      });

      expect(result.details.success).toBe(true);
      expect(result.details.updated_cells).toBe(3);
    });

    it("sheets_append — appends two data rows", async () => {
      expect(createdSpreadsheetId).toBeTruthy();

      const tool = createSheetsAppendTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        spreadsheet_id: createdSpreadsheetId,
        sheet: "Sheet1",
        values: [
          ["Alice", "alice@example.com", "95"],
          ["Bob", "bob@example.com", "87"],
        ],
      });

      expect(result.details.success).toBe(true);
      expect(result.details.appended_rows).toBe(2);
    });

    it("sheets_get — reads the written data back", async () => {
      expect(createdSpreadsheetId).toBeTruthy();

      const tool = createSheetsGetTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        spreadsheet_id: createdSpreadsheetId,
        range: "Sheet1!A1:C3",
      });

      expect(Array.isArray(result.details.values)).toBe(true);
      expect(result.details.rowCount).toBe(3);
      expect(result.details.values[0]).toEqual(["Name", "Email", "Score"]);
      expect(result.details.values[1][0]).toBe("Alice");
      expect(result.details.values[2][0]).toBe("Bob");
    });

    it("sheets_export — exports the spreadsheet as XLSX", async () => {
      expect(createdSpreadsheetId).toBeTruthy();

      const tool = createSheetsExportTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        spreadsheet_id: createdSpreadsheetId,
        save_dir: SHEETS_SAVE_DIR,
        format: "xlsx",
      });

      expect(result.details.success !== false).toBe(true);
      expect(typeof result.details.path).toBe("string");
      expect(existsSync(result.details.path)).toBe(true);
      expect(result.details.size).toBeGreaterThan(0);
    });

    it("sheets_export — exports the spreadsheet as CSV", async () => {
      expect(createdSpreadsheetId).toBeTruthy();

      const tool = createSheetsExportTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        spreadsheet_id: createdSpreadsheetId,
        save_dir: SHEETS_SAVE_DIR,
        format: "csv",
      });

      expect(result.details.success !== false).toBe(true);
      expect(typeof result.details.path).toBe("string");
      expect(existsSync(result.details.path)).toBe(true);
      expect(result.details.size).toBeGreaterThan(0);
    });

    it("sheets_clear — clears the data range", async () => {
      expect(createdSpreadsheetId).toBeTruthy();

      const tool = createSheetsClearTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        spreadsheet_id: createdSpreadsheetId,
        range: "Sheet1!A1:C3",
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.cleared_range).toBe("string");
    });

    it("sheets_get — confirms range is empty after clear", async () => {
      expect(createdSpreadsheetId).toBeTruthy();

      const tool = createSheetsGetTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        spreadsheet_id: createdSpreadsheetId,
        range: "Sheet1!A1:C3",
      });

      expect(result.details.rowCount).toBe(0);
    });

    it("drive_delete — permanently deletes the test spreadsheet", async () => {
      expect(createdSpreadsheetId).toBeTruthy();

      const tool = createDriveDeleteTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        file_id: createdSpreadsheetId,
        permanent: true,
      });

      expect(result.details.success).toBe(true);
    });
  });
});
