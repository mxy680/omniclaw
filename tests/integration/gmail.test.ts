/**
 * Integration tests — hit the real Gmail API.
 *
 * Required env vars (or fall back to detected defaults):
 *   CLIENT_SECRET_PATH   path to client_secret.json
 *   TOKENS_PATH          path to omniclaw-tokens.json  (default: ~/.openclaw/omniclaw-tokens.json)
 *   GMAIL_ACCOUNT        token store account name       (default: "default")
 *
 * Write tests are skipped unless:
 *   RUN_WRITE_TESTS=1    enable send / modify tests
 *   TEST_RECIPIENT       email to send test messages to (default: authenticated user's own address)
 */

import {
  existsSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OAuthClientManager } from "../../src/auth/oauth-client-manager.js";
import { TokenStore } from "../../src/auth/token-store.js";
import { createGmailAccountsTool } from "../../src/tools/gmail-accounts.js";
import {
  createGmailGetTool,
  createGmailDownloadAttachmentTool,
} from "../../src/tools/gmail-get.js";
import { createGmailInboxTool, createGmailSearchTool } from "../../src/tools/gmail-inbox.js";
import { createGmailModifyTool } from "../../src/tools/gmail-modify.js";
import {
  createGmailSendTool,
  createGmailReplyTool,
  createGmailForwardTool,
} from "../../src/tools/gmail-send.js";

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

if (!credentialsExist) {
  console.warn(
    "\n[integration] Skipping: credentials not found.\n" +
      `  CLIENT_SECRET_PATH=${CLIENT_SECRET_PATH}\n` +
      `  TOKENS_PATH=${TOKENS_PATH}\n`,
  );
}

// ---------------------------------------------------------------------------
// Shared state populated in beforeAll
// ---------------------------------------------------------------------------
let clientManager: OAuthClientManager;
let firstMessageId: string; // grabbed from inbox, reused in get/reply/forward tests

// Temporary directory used by attachment download tests and write tests.
// Using a fixed suffix so it is accessible across describe blocks.
const GMAIL_SAVE_DIR = join(tmpdir(), `omniclaw-gmail-test-${Date.now()}`);

// ---------------------------------------------------------------------------
describe.skipIf(!credentialsExist)("Gmail API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    const tokenStore = new TokenStore(TOKENS_PATH);
    clientManager = new OAuthClientManager(CLIENT_SECRET_PATH, 9753, tokenStore);
  });

  // -------------------------------------------------------------------------
  // gmail_accounts
  // -------------------------------------------------------------------------
  describe("gmail_accounts", () => {
    it("returns the authenticated account with an email", async () => {
      const tool = createGmailAccountsTool(clientManager);
      const result = await tool.execute();

      expect(result.details.accounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ account: ACCOUNT, email: expect.any(String) }),
        ]),
      );
    });
  });

  // -------------------------------------------------------------------------
  // gmail_inbox
  // -------------------------------------------------------------------------
  describe("gmail_inbox", () => {
    it("returns an array of inbox messages", async () => {
      const tool = createGmailInboxTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, max_results: 5 });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);

      const msg = result.details[0];
      firstMessageId = msg.id; // save for later tests
      expect(typeof msg.id).toBe("string");
      expect(typeof msg.subject).toBe("string");
      expect(typeof msg.from).toBe("string");
      expect(typeof msg.date).toBe("string");
      expect(typeof msg.snippet).toBe("string");
    });

    it("respects max_results", async () => {
      const tool = createGmailInboxTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, max_results: 2 });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeLessThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // gmail_search
  // -------------------------------------------------------------------------
  describe("gmail_search", () => {
    it("returns results for a broad query", async () => {
      const tool = createGmailSearchTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        query: "in:inbox",
        max_results: 3,
      });

      expect(Array.isArray(result.details)).toBe(true);
      if (result.details.length > 0) {
        expect(result.details[0]).toHaveProperty("id");
        expect(result.details[0]).toHaveProperty("subject");
      }
    });

    it("returns an empty array for a query that matches nothing", async () => {
      const tool = createGmailSearchTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        query: "subject:zzz_no_such_email_xyzxyz_omniclaw_test",
      });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // gmail_get
  // -------------------------------------------------------------------------
  describe("gmail_get", () => {
    it("fetches the full body of a message by ID", async () => {
      expect(firstMessageId).toBeTruthy(); // set by inbox test

      const tool = createGmailGetTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, id: firstMessageId });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.id).toBe(firstMessageId);
      expect(typeof result.details.subject).toBe("string");
      expect(typeof result.details.from).toBe("string");
      expect(typeof result.details.date).toBe("string");
      // At least one of plain/html body should be present
      const hasBody =
        (result.details.body_text as string).length > 0 ||
        (result.details.body_html as string).length > 0;
      expect(hasBody).toBe(true);
      // Response must include an attachments array (may be empty for plain emails)
      expect(Array.isArray(result.details.attachments)).toBe(true);
    });

    it("returns an error object for a non-existent message ID", async () => {
      const tool = createGmailGetTool(clientManager);
      await expect(
        tool.execute("t", { account: ACCOUNT, id: "000000000000dead" }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // gmail_download_attachment
  // -------------------------------------------------------------------------
  describe("gmail_download_attachment", () => {
    afterAll(() => {
      try {
        if (existsSync(GMAIL_SAVE_DIR)) {
          for (const file of readdirSync(GMAIL_SAVE_DIR)) {
            unlinkSync(join(GMAIL_SAVE_DIR, file));
          }
          rmdirSync(GMAIL_SAVE_DIR);
        }
      } catch { /* best-effort cleanup */ }
    });

    it("downloads an attachment when available", async () => {
      // Search for an email that has at least one attachment.
      const searchTool = createGmailSearchTool(clientManager);
      const searchResult = await searchTool.execute("t", {
        account: ACCOUNT,
        query: "has:attachment",
        max_results: 1,
      });

      if (searchResult.details.length === 0) {
        console.warn("[gmail] No emails with attachments found — skipping download test");
        return;
      }

      const messageId = searchResult.details[0].id;

      // Fetch full message to get attachment metadata.
      const getTool = createGmailGetTool(clientManager);
      const getResult = await getTool.execute("t", { account: ACCOUNT, id: messageId });

      expect(Array.isArray(getResult.details.attachments)).toBe(true);

      if (getResult.details.attachments.length === 0) {
        console.warn("[gmail] Message has no downloadable attachments — skipping");
        return;
      }

      const attachment = getResult.details.attachments[0];
      expect(typeof attachment.attachmentId).toBe("string");
      expect(typeof attachment.filename).toBe("string");

      // Download the attachment to the shared temp directory.
      const downloadTool = createGmailDownloadAttachmentTool(clientManager);
      const downloadResult = await downloadTool.execute("t", {
        account: ACCOUNT,
        id: messageId,
        attachment_id: attachment.attachmentId,
        filename: attachment.filename,
        save_dir: GMAIL_SAVE_DIR,
      });

      expect(downloadResult.details).not.toHaveProperty("error");
      expect(typeof downloadResult.details.path).toBe("string");
      expect(existsSync(downloadResult.details.path)).toBe(true);
      expect(downloadResult.details.size).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // gmail_modify  (always-on — uses reversible mark_read/mark_unread)
  // -------------------------------------------------------------------------
  describe("gmail_modify", () => {
    it("mark_unread then mark_read on a real message succeeds", async () => {
      expect(firstMessageId).toBeTruthy();

      const tool = createGmailModifyTool(clientManager);

      const unread = await tool.execute("t", {
        account: ACCOUNT,
        id: firstMessageId,
        action: "mark_unread",
      });
      expect(unread.details).toMatchObject({ success: true, action: "mark_unread" });

      const read = await tool.execute("t", {
        account: ACCOUNT,
        id: firstMessageId,
        action: "mark_read",
      });
      expect(read.details).toMatchObject({ success: true, action: "mark_read" });
    });

    it("archive then unarchive a message", async () => {
      expect(firstMessageId).toBeTruthy();

      const tool = createGmailModifyTool(clientManager);

      const archived = await tool.execute("t", {
        account: ACCOUNT,
        id: firstMessageId,
        action: "archive",
      });
      expect(archived.details).toMatchObject({ success: true, action: "archive" });

      // Restore to inbox by adding INBOX label back directly via modify
      const { google } = await import("googleapis");
      const client = clientManager.getClient(ACCOUNT);
      const gmail = google.gmail({ version: "v1", auth: client });
      await gmail.users.messages.modify({
        userId: "me",
        id: firstMessageId,
        requestBody: { addLabelIds: ["INBOX"] },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Write tests — opt-in via RUN_WRITE_TESTS=1
  // -------------------------------------------------------------------------
  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    let sentMessageId: string;
    let sentThreadId: string;

    it("gmail_send — delivers an email to the test recipient", async () => {
      const recipient = process.env.TEST_RECIPIENT ?? (await getSelfEmail());
      const tool = createGmailSendTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        to: recipient,
        subject: `[omniclaw integration test] ${new Date().toISOString()}`,
        body: "This is an automated integration test from omniclaw. Safe to delete.",
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.id).toBe("string");
      sentMessageId = result.details.id;
      sentThreadId = result.details.threadId;
    });

    it("gmail_send — sends an email with an attachment", async () => {
      // Create a small temp file to use as the attachment.
      if (!existsSync(GMAIL_SAVE_DIR)) {
        mkdirSync(GMAIL_SAVE_DIR, { recursive: true });
      }
      const tempFile = join(GMAIL_SAVE_DIR, "test-attachment.txt");
      writeFileSync(tempFile, "This is a test attachment from omniclaw integration tests.");

      const recipient = process.env.TEST_RECIPIENT ?? (await getSelfEmail());
      const tool = createGmailSendTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        to: recipient,
        subject: `[omniclaw integration test] attachment ${new Date().toISOString()}`,
        body: "This email has an attachment. Safe to delete.",
        attachments: [{ file_path: tempFile, filename: "test-attachment.txt" }],
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.id).toBe("string");
    });

    it("gmail_reply — replies within the sent thread", async () => {
      expect(sentMessageId).toBeTruthy();

      const tool = createGmailReplyTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        id: sentMessageId,
        body: "Integration test reply. Safe to delete.",
      });

      expect(result.details.success).toBe(true);
      expect(result.details.threadId).toBe(sentThreadId);
    });

    it("gmail_forward — forwards the sent message", async () => {
      expect(sentMessageId).toBeTruthy();

      const recipient = process.env.TEST_RECIPIENT ?? (await getSelfEmail());
      const tool = createGmailForwardTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        id: sentMessageId,
        to: recipient,
        body: "Integration test forward. Safe to delete.",
      });

      expect(result.details.success).toBe(true);
    });

    it("gmail_modify trash — trashes the sent message", async () => {
      expect(sentMessageId).toBeTruthy();

      const tool = createGmailModifyTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        id: sentMessageId,
        action: "trash",
      });

      expect(result.details).toMatchObject({ success: true, action: "trash" });
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
