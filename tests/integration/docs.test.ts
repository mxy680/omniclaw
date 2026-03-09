/**
 * Integration tests — hit the real Google Docs API.
 *
 * Uses the same credentials as Gmail, Calendar, and Drive (shared OAuth flow).
 *
 * Required env vars (or fall back to detected defaults):
 *   CLIENT_SECRET_PATH   path to client_secret.json
 *   TOKENS_PATH          path to omniclaw-tokens.json  (default: ~/.openclaw/omniclaw-tokens.json)
 *   GMAIL_ACCOUNT        token store account name       (default: "default")
 *
 * Write tests are skipped unless:
 *   RUN_WRITE_TESTS=1    enable create / get / append / replace / delete tests
 */

import { existsSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OAuthClientManager } from "../../src/auth/oauth-client-manager.js";
import { TokenStore } from "../../src/auth/token-store.js";
import { createDocsAppendTool } from "../../src/tools/docs-append.js";
import { createDocsCreateTool } from "../../src/tools/docs-create.js";
import { createDocsExportTool } from "../../src/tools/docs-download.js";
import { createDocsGetTool } from "../../src/tools/docs-get.js";
import { createDocsInsertTool } from "../../src/tools/docs-insert.js";
import { createDocsDeleteTextTool } from "../../src/tools/docs-delete-text.js";
import { createDocsReplaceTextTool } from "../../src/tools/docs-replace-text.js";
import { createDriveDeleteTool } from "../../src/tools/drive-delete.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CLIENT_SECRET_PATH =
  process.env.CLIENT_SECRET_PATH ??
  join(homedir(), ".openclaw", "client_secret.json");

const TOKENS_PATH = process.env.TOKENS_PATH ?? join(homedir(), ".openclaw", "omniclaw-tokens.json");

const ACCOUNT = process.env.GMAIL_ACCOUNT ?? "default";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

const credentialsExist = existsSync(CLIENT_SECRET_PATH) && existsSync(TOKENS_PATH);

const DOCS_SAVE_DIR = join(tmpdir(), `omniclaw-docs-test-${Date.now()}`);

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
let createdDocId: string;

// ---------------------------------------------------------------------------
describe.skipIf(!credentialsExist)("Google Docs API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    const tokenStore = new TokenStore(TOKENS_PATH);
    clientManager = new OAuthClientManager(CLIENT_SECRET_PATH, 9753, tokenStore);
  });

  afterAll(() => {
    if (existsSync(DOCS_SAVE_DIR)) {
      for (const file of readdirSync(DOCS_SAVE_DIR)) {
        unlinkSync(join(DOCS_SAVE_DIR, file));
      }
      rmdirSync(DOCS_SAVE_DIR);
    }
  });

  // -------------------------------------------------------------------------
  // Write tests — opt-in via RUN_WRITE_TESTS=1
  // -------------------------------------------------------------------------
  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    it("docs_create — creates a doc with initial content", async () => {
      const tool = createDocsCreateTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        title: "[omniclaw integration test] docs_create",
        content: "Hello from omniclaw.\nThis is a test document.",
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.id).toBe("string");
      expect(result.details.id.length).toBeGreaterThan(0);
      expect(typeof result.details.url).toBe("string");
      expect(result.details.url).toContain(result.details.id);

      createdDocId = result.details.id;
    });

    it("docs_get — reads the created document content", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDocsGetTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, document_id: createdDocId });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.id).toBe(createdDocId);
      expect(result.details.title).toBe("[omniclaw integration test] docs_create");
      expect(result.details.content).toContain("Hello from omniclaw.");
      expect(typeof result.details.characterCount).toBe("number");
      expect(result.details.characterCount).toBeGreaterThan(0);
    });

    it("docs_append — appends text to the document", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDocsAppendTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        document_id: createdDocId,
        text: "\nAppended by omniclaw integration test.",
      });

      expect(result.details.success).toBe(true);
      expect(result.details.document_id).toBe(createdDocId);
      expect(result.details.characters_added).toBeGreaterThan(0);
    });

    it("docs_get — confirms appended text is present", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDocsGetTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, document_id: createdDocId });

      expect(result.details.content).toContain("Appended by omniclaw integration test.");
    });

    it("docs_insert — inserts text at the beginning of the document", async () => {
      expect(createdDocId).toBeTruthy();

      const insertText = "INSERTED_TEXT: ";
      const tool = createDocsInsertTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        document_id: createdDocId,
        text: insertText,
        index: 1,
      });

      expect(result.details.success).toBe(true);
      expect(result.details.document_id).toBe(createdDocId);
      expect(result.details.characters_added).toBe(insertText.length);
    });

    it("docs_get — confirms inserted text is present", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDocsGetTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, document_id: createdDocId });

      expect(result.details.content).toContain("INSERTED_TEXT: ");
    });

    it("docs_delete_text — deletes the inserted text", async () => {
      expect(createdDocId).toBeTruthy();

      const insertText = "INSERTED_TEXT: ";
      const tool = createDocsDeleteTextTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        document_id: createdDocId,
        start_index: 1,
        end_index: 1 + insertText.length,
      });

      expect(result.details.success).toBe(true);
      expect(result.details.deleted_range.start).toBe(1);
      expect(result.details.deleted_range.end).toBe(1 + insertText.length);
    });

    it("docs_get — confirms deleted text is gone", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDocsGetTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, document_id: createdDocId });

      expect(result.details.content).not.toContain("INSERTED_TEXT: ");
    });

    it("docs_replace_text — replaces a string in the document", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDocsReplaceTextTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        document_id: createdDocId,
        find: "omniclaw",
        replace: "OMNICLAW",
        match_case: true,
      });

      expect(result.details.success).toBe(true);
      expect(result.details.occurrences_replaced).toBeGreaterThan(0);
    });

    it("docs_get — confirms replacement took effect", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDocsGetTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, document_id: createdDocId });

      expect(result.details.content).toContain("OMNICLAW");
      expect(result.details.content).not.toContain("omniclaw");
    });

    it("docs_export — exports the document as PDF", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDocsExportTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        document_id: createdDocId,
        save_dir: DOCS_SAVE_DIR,
        format: "pdf",
      });

      expect(result.details.success !== false).toBe(true);
      expect(typeof result.details.path).toBe("string");
      expect(existsSync(result.details.path)).toBe(true);
      expect(result.details.mimeType).toBe("application/pdf");
      expect(result.details.size).toBeGreaterThan(0);
    });

    it("docs_export — exports the document as DOCX", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDocsExportTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        document_id: createdDocId,
        save_dir: DOCS_SAVE_DIR,
        format: "docx",
      });

      expect(result.details.success !== false).toBe(true);
      expect(typeof result.details.path).toBe("string");
      expect(existsSync(result.details.path)).toBe(true);
      expect(result.details.size).toBeGreaterThan(0);
    });

    it("drive_delete — permanently deletes the test document", async () => {
      expect(createdDocId).toBeTruthy();

      const tool = createDriveDeleteTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        file_id: createdDocId,
        permanent: true,
      });

      expect(result.details.success).toBe(true);
    });
  });
});
