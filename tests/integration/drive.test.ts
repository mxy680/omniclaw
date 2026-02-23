/**
 * Integration tests — hit the real Google Drive API.
 *
 * Uses the same credentials as Gmail and Calendar (shared OAuth flow).
 *
 * Required env vars (or fall back to detected defaults):
 *   CLIENT_SECRET_PATH   path to client_secret.json
 *   TOKENS_PATH          path to omniclaw-tokens.json  (default: ~/.openclaw/omniclaw-tokens.json)
 *   GMAIL_ACCOUNT        token store account name       (default: "default")
 *
 * Write tests are skipped unless:
 *   RUN_WRITE_TESTS=1    enable upload / create folder / move / share / delete tests
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { OAuthClientManager } from "../../src/auth/oauth-client-manager.js";
import { TokenStore } from "../../src/auth/token-store.js";
import { createDriveCreateFolderTool } from "../../src/tools/drive-create-folder.js";
import { createDriveDeleteTool } from "../../src/tools/drive-delete.js";
import { createDriveGetTool } from "../../src/tools/drive-get.js";
import { createDriveListTool } from "../../src/tools/drive-list.js";
import { createDriveMoveTool } from "../../src/tools/drive-move.js";
import { createDriveReadTool } from "../../src/tools/drive-read.js";
import { createDriveSearchTool } from "../../src/tools/drive-search.js";
import { createDriveShareTool } from "../../src/tools/drive-share.js";
import { createDriveUploadTool } from "../../src/tools/drive-upload.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CLIENT_SECRET_PATH =
  process.env.CLIENT_SECRET_PATH ??
  "/Users/markshteyn/Downloads/client_secret_772791512967-bb4nvpsu9umlr74nt12cjvloaq6hcale.apps.googleusercontent.com.json";

const TOKENS_PATH = process.env.TOKENS_PATH ?? join(homedir(), ".openclaw", "omniclaw-tokens.json");

const ACCOUNT = process.env.GMAIL_ACCOUNT ?? "default";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

const credentialsExist = existsSync(CLIENT_SECRET_PATH) && existsSync(TOKENS_PATH);

if (!credentialsExist) {
  console.warn(
    "\n[integration] Skipping: credentials not found.\n" +
      `  CLIENT_SECRET_PATH=${CLIENT_SECRET_PATH}\n` +
      `  TOKENS_PATH=${TOKENS_PATH}\n`,
  );
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let clientManager: OAuthClientManager;
let uploadedFileId: string; // set by drive_upload, reused by get/read/move/delete
let createdFolderId: string; // set by drive_create_folder, reused by move/delete

// ---------------------------------------------------------------------------
describe.skipIf(!credentialsExist)("Google Drive API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    const tokenStore = new TokenStore(TOKENS_PATH);
    clientManager = new OAuthClientManager(CLIENT_SECRET_PATH, 9753, tokenStore);
  });

  // -------------------------------------------------------------------------
  // drive_list
  // -------------------------------------------------------------------------
  describe("drive_list", () => {
    it("returns an array from the Drive root", async () => {
      const tool = createDriveListTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, max_results: 5 });

      expect(Array.isArray(result.details)).toBe(true);
    });

    it("each item has required fields when results exist", async () => {
      const tool = createDriveListTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, max_results: 5 });

      if (result.details.length > 0) {
        const file = result.details[0];
        expect(typeof file.id).toBe("string");
        expect(typeof file.name).toBe("string");
        expect(typeof file.mimeType).toBe("string");
        expect(typeof file.modifiedTime).toBe("string");
      }
    });

    it("respects max_results", async () => {
      const tool = createDriveListTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, max_results: 2 });

      expect(result.details.length).toBeLessThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // drive_search
  // -------------------------------------------------------------------------
  describe("drive_search", () => {
    it("returns an array for a broad query", async () => {
      const tool = createDriveSearchTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        query: "mimeType != 'application/vnd.google-apps.folder'",
        max_results: 5,
      });

      expect(Array.isArray(result.details)).toBe(true);
    });

    it("returns empty array for a query that matches nothing", async () => {
      const tool = createDriveSearchTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        query: "name = '__omniclaw_nonexistent_file_xyz__'",
      });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Write tests — opt-in via RUN_WRITE_TESTS=1
  // -------------------------------------------------------------------------
  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    it("drive_upload — creates a plain-text file and returns its ID", async () => {
      const tool = createDriveUploadTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        name: "[omniclaw integration test] drive_upload.txt",
        content: "Hello from omniclaw integration test.\nSafe to delete.",
        mime_type: "text/plain",
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.id).toBe("string");
      expect(result.details.id.length).toBeGreaterThan(0);
      expect(typeof result.details.webViewLink).toBe("string");

      uploadedFileId = result.details.id;
    });

    it("drive_get — fetches the uploaded file with correct fields", async () => {
      expect(uploadedFileId).toBeTruthy();

      const tool = createDriveGetTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, file_id: uploadedFileId });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.id).toBe(uploadedFileId);
      expect(result.details.name).toBe("[omniclaw integration test] drive_upload.txt");
      expect(result.details.mimeType).toBe("text/plain");
      expect(typeof result.details.webViewLink).toBe("string");
      expect(Array.isArray(result.details.owners)).toBe(true);
    });

    it("drive_read — reads the uploaded file content", async () => {
      expect(uploadedFileId).toBeTruthy();

      const tool = createDriveReadTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, file_id: uploadedFileId });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.id).toBe(uploadedFileId);
      expect(result.details.content).toContain("Hello from omniclaw integration test.");
    });

    it("drive_create_folder — creates a test folder", async () => {
      const tool = createDriveCreateFolderTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        name: "[omniclaw integration test] drive_create_folder",
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.id).toBe("string");
      expect(result.details.id.length).toBeGreaterThan(0);

      createdFolderId = result.details.id;
    });

    it("drive_move — moves the uploaded file into the test folder", async () => {
      expect(uploadedFileId).toBeTruthy();
      expect(createdFolderId).toBeTruthy();

      const tool = createDriveMoveTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        file_id: uploadedFileId,
        folder_id: createdFolderId,
      });

      expect(result.details.success).toBe(true);
      expect(result.details.id).toBe(uploadedFileId);
      expect(result.details.parents).toContain(createdFolderId);
    });

    it("drive_share — shares the uploaded file as reader with self", async () => {
      expect(uploadedFileId).toBeTruthy();

      const selfEmail = await getSelfEmail();
      const tool = createDriveShareTool(clientManager);

      // Share with self as reader (no-op permission but validates the API call)
      const result = await tool.execute("t", {
        account: ACCOUNT,
        file_id: uploadedFileId,
        email: selfEmail,
        role: "reader",
        notify: false,
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.permission_id).toBe("string");
    });

    it("drive_delete — trashes the uploaded file", async () => {
      expect(uploadedFileId).toBeTruthy();

      const tool = createDriveDeleteTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        file_id: uploadedFileId,
        permanent: false,
      });

      expect(result.details.success).toBe(true);
      expect(result.details.file_id).toBe(uploadedFileId);
      expect(result.details.permanent).toBe(false);
    });

    it("drive_delete — permanently deletes the test folder", async () => {
      expect(createdFolderId).toBeTruthy();

      const tool = createDriveDeleteTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        file_id: createdFolderId,
        permanent: true,
      });

      expect(result.details.success).toBe(true);
      expect(result.details.permanent).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function getSelfEmail(): Promise<string> {
  const { google } = await import("googleapis");
  const client = clientManager.getClient(ACCOUNT);
  const gmail = google.gmail({ version: "v1", auth: client });
  const res = await gmail.users.getProfile({ userId: "me" });
  return res.data.emailAddress ?? "me";
}
