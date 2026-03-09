/**
 * Hourly smoke tests — health checks for all omniclaw integrations.
 *
 * Run via:  pnpm test:smoke
 *
 * Includes both read-only checks and write-then-cleanup checks.
 * Write tests create a resource, verify it, and immediately delete it.
 * Designed to complete in under 90 seconds total.
 *
 * Environment variables (same as regular integration tests):
 *   CLIENT_SECRET_PATH   path to client_secret.json  (default: ~/.openclaw/client_secret.json)
 *   TOKENS_PATH          path to omniclaw-tokens.json (default: ~/.openclaw/omniclaw-tokens.json)
 *   SMOKE_LOG_DIR        directory for JSON result logs (default: ~/.openclaw/smoke-logs)
 */

import { existsSync, mkdirSync, appendFileSync, unlinkSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OAuthClientManager } from "../../src/auth/oauth-client-manager.js";
import { TokenStore } from "../../src/auth/token-store.js";

// Read-only tool imports
import { createGmailAccountsTool } from "../../src/tools/gmail-accounts.js";
import { createGmailInboxTool, createGmailSearchTool } from "../../src/tools/gmail-inbox.js";
import { createCalendarListCalendarsTool } from "../../src/tools/calendar-list-calendars.js";
import { createCalendarEventsTool } from "../../src/tools/calendar-events.js";
import { createDriveListTool } from "../../src/tools/drive-list.js";
import { createDriveSearchTool } from "../../src/tools/drive-search.js";
import { createDocsGetTool } from "../../src/tools/docs-get.js";
import { createSheetsGetTool } from "../../src/tools/sheets-get.js";
import { createSlidesGetTool } from "../../src/tools/slides-get.js";
import { createYouTubeTranscriptTool } from "../../src/tools/youtube-transcript.js";
import {
  createYouTubeSearchTool,
  createYouTubeVideoDetailsTool,
} from "../../src/tools/youtube-search.js";
import { createYouTubeChannelInfoTool } from "../../src/tools/youtube-social.js";

// Write tool imports
import { createGmailSendTool } from "../../src/tools/gmail-send.js";
import { createGmailModifyTool } from "../../src/tools/gmail-modify.js";
import { createCalendarCreateTool } from "../../src/tools/calendar-create.js";
import { createCalendarDeleteTool } from "../../src/tools/calendar-delete.js";
import { createDriveUploadTool } from "../../src/tools/drive-upload.js";
import { createDriveDownloadTool } from "../../src/tools/drive-download.js";
import { createDriveDeleteTool } from "../../src/tools/drive-delete.js";
import { createDocsCreateTool } from "../../src/tools/docs-create.js";
import { createDocsAppendTool } from "../../src/tools/docs-append.js";
import { createDocsExportTool } from "../../src/tools/docs-download.js";
import { createSheetsCreateTool } from "../../src/tools/sheets-create.js";
import { createSheetsUpdateTool } from "../../src/tools/sheets-update.js";
import { createSheetsExportTool } from "../../src/tools/sheets-download.js";
import { createSlidesCreateTool } from "../../src/tools/slides-create.js";
import { createSlidesAppendSlideTool } from "../../src/tools/slides-append-slide.js";
import { createSlidesExportTool } from "../../src/tools/slides-download.js";

// GitHub tool imports
import { ApiKeyStore } from "../../src/auth/api-key-store.js";
import { GitHubClientManager } from "../../src/auth/github-client-manager.js";
import { createGitHubAuthSetupTool } from "../../src/tools/github-auth.js";
import { createGitHubRepoGetTool, createGitHubRepoListTool } from "../../src/tools/github-repos.js";
import { createGitHubSearchReposTool } from "../../src/tools/github-search.js";
import { createGitHubUserGetTool } from "../../src/tools/github-users.js";
import { createGitHubGistListTool, createGitHubGistCreateTool, createGitHubGistDeleteTool } from "../../src/tools/github-gists.js";

// Wolfram Alpha tool imports
import { WolframClientManager } from "../../src/auth/wolfram-client-manager.js";
import { createWolframQueryTool, createWolframQueryFullTool } from "../../src/tools/wolfram-query.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CLIENT_SECRET_PATH =
  process.env.CLIENT_SECRET_PATH ??
  join(homedir(), ".openclaw", "client_secret.json");

const TOKENS_PATH =
  process.env.TOKENS_PATH ??
  join(homedir(), ".openclaw", "omniclaw-tokens.json");

const ACCOUNT = process.env.GMAIL_ACCOUNT ?? "default";

const SMOKE_LOG_DIR =
  process.env.SMOKE_LOG_DIR ??
  join(homedir(), ".openclaw", "smoke-logs");

const credentialsExist =
  existsSync(CLIENT_SECRET_PATH) && existsSync(TOKENS_PATH);

if (!credentialsExist) {
  console.warn(
    "\n[smoke] Google OAuth credentials not found — authenticated checks will be skipped.\n" +
      `  CLIENT_SECRET_PATH=${CLIENT_SECRET_PATH}\n` +
      `  TOKENS_PATH=${TOKENS_PATH}\n`,
  );
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const githubTokenExists = GITHUB_TOKEN.length > 0;

if (!githubTokenExists) {
  console.warn(
    "\n[smoke] GITHUB_TOKEN not set — GitHub checks will be skipped.\n",
  );
}

const WOLFRAM_APPID = process.env.WOLFRAM_APPID ?? "";
const wolframAppIdExists = WOLFRAM_APPID.length > 0;

if (!wolframAppIdExists) {
  console.warn(
    "\n[smoke] WOLFRAM_APPID not set — Wolfram Alpha checks will be skipped.\n",
  );
}

// ---------------------------------------------------------------------------
// Smoke check tracking
// ---------------------------------------------------------------------------
interface SmokeCheckResult {
  service: string;
  check: string;
  status: "pass" | "fail" | "skip";
  durationMs: number;
  error?: string;
}

const results: SmokeCheckResult[] = [];
const suiteStart = Date.now();

async function smokeCheck<T>(
  service: string,
  check: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    results.push({ service, check, status: "pass", durationMs: Date.now() - start });
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    results.push({ service, check, status: "fail", durationMs, error });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Summary table
// ---------------------------------------------------------------------------
function printSummaryTable(): void {
  const totalDuration = Date.now() - suiteStart;
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  console.log("\n" + "=".repeat(72));
  console.log("  OMNICLAW SMOKE TEST SUMMARY");
  console.log("=".repeat(72));
  console.log("");

  const header = `  ${"Service".padEnd(12)} ${"Check".padEnd(35)} ${"Status".padEnd(8)} ${"Time".padEnd(8)}`;
  console.log(header);
  console.log("  " + "-".repeat(68));

  for (const r of results) {
    const statusIcon = r.status === "pass" ? "OK" : r.status === "fail" ? "FAIL" : "SKIP";
    const time = `${r.durationMs}ms`;
    console.log(
      `  ${r.service.padEnd(12)} ${r.check.padEnd(35)} ${statusIcon.padEnd(8)} ${time.padEnd(8)}`,
    );
    if (r.error) {
      console.log(`  ${"".padEnd(12)} -> ${r.error.slice(0, 55)}`);
    }
  }

  console.log("");
  console.log(
    `  Total: ${results.length} checks | ${passed} passed | ${failed} failed | ${skipped} skipped`,
  );
  console.log(`  Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log("=".repeat(72) + "\n");
}

// ---------------------------------------------------------------------------
// NDJSON log writer
// ---------------------------------------------------------------------------
function writeLogFile(): void {
  try {
    if (!existsSync(SMOKE_LOG_DIR)) {
      mkdirSync(SMOKE_LOG_DIR, { recursive: true });
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - suiteStart,
      passed: results.filter((r) => r.status === "pass").length,
      failed: results.filter((r) => r.status === "fail").length,
      skipped: results.filter((r) => r.status === "skip").length,
      checks: results,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const logPath = join(SMOKE_LOG_DIR, `smoke-${dateStr}.ndjson`);
    appendFileSync(logPath, JSON.stringify(logEntry) + "\n", "utf-8");
  } catch (err) {
    console.warn("[smoke] Failed to write log file:", err);
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
let clientManager: OAuthClientManager;

describe("Omniclaw Smoke Tests", { timeout: 90_000 }, () => {
  beforeAll(() => {
    if (credentialsExist) {
      const tokenStore = new TokenStore(TOKENS_PATH);
      clientManager = new OAuthClientManager(CLIENT_SECRET_PATH, 9753, tokenStore);
    }
  });

  afterAll(() => {
    printSummaryTable();
    writeLogFile();
  });

  // -------------------------------------------------------------------------
  // Gmail (3 checks)
  // -------------------------------------------------------------------------
  describe("Gmail", () => {
    it.skipIf(!credentialsExist)("gmail_accounts — list authenticated accounts", async () => {
      const result = await smokeCheck("Gmail", "gmail_accounts", async () => {
        const tool = createGmailAccountsTool(clientManager);
        return tool.execute();
      });
      expect(result.details.accounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ account: ACCOUNT, email: expect.any(String) }),
        ]),
      );
    });

    it.skipIf(!credentialsExist)("gmail_inbox — fetch 1 recent message", async () => {
      const result = await smokeCheck("Gmail", "gmail_inbox", async () => {
        const tool = createGmailInboxTool(clientManager);
        return tool.execute("smoke", { account: ACCOUNT, max_results: 1 });
      });
      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
    });

    it.skipIf(!credentialsExist)("gmail_search — search inbox", async () => {
      const result = await smokeCheck("Gmail", "gmail_search", async () => {
        const tool = createGmailSearchTool(clientManager);
        return tool.execute("smoke", { account: ACCOUNT, query: "in:inbox", max_results: 1 });
      });
      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Calendar (2 checks)
  // -------------------------------------------------------------------------
  describe("Calendar", () => {
    it.skipIf(!credentialsExist)("calendar_list_calendars — list calendars", async () => {
      const result = await smokeCheck("Calendar", "calendar_list_calendars", async () => {
        const tool = createCalendarListCalendarsTool(clientManager);
        return tool.execute("smoke", { account: ACCOUNT });
      });
      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);
    });

    it.skipIf(!credentialsExist)("calendar_events — list next event", async () => {
      const result = await smokeCheck("Calendar", "calendar_events", async () => {
        const tool = createCalendarEventsTool(clientManager);
        return tool.execute("smoke", { account: ACCOUNT, max_results: 1 });
      });
      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Drive (2 checks)
  // -------------------------------------------------------------------------
  describe("Drive", () => {
    it.skipIf(!credentialsExist)("drive_list — list root files", async () => {
      const result = await smokeCheck("Drive", "drive_list", async () => {
        const tool = createDriveListTool(clientManager);
        return tool.execute("smoke", { account: ACCOUNT, max_results: 1 });
      });
      expect(Array.isArray(result.details)).toBe(true);
    });

    it.skipIf(!credentialsExist)("drive_search — search for any file", async () => {
      const result = await smokeCheck("Drive", "drive_search", async () => {
        const tool = createDriveSearchTool(clientManager);
        return tool.execute("smoke", {
          account: ACCOUNT,
          query: "mimeType != 'application/vnd.google-apps.folder'",
          max_results: 1,
        });
      });
      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Docs (1 check — discovers a doc via Drive search)
  // -------------------------------------------------------------------------
  describe("Docs", () => {
    it.skipIf(!credentialsExist)("docs_get — fetch first available document", async () => {
      await smokeCheck("Docs", "docs_get", async () => {
        const searchTool = createDriveSearchTool(clientManager);
        const searchResult = await searchTool.execute("smoke", {
          account: ACCOUNT,
          query: "mimeType = 'application/vnd.google-apps.document'",
          max_results: 1,
        });

        if (searchResult.details.length === 0) {
          console.warn("[smoke] No Google Docs found in Drive — skipping docs_get read");
          return searchResult;
        }

        const docId = searchResult.details[0].id;
        const tool = createDocsGetTool(clientManager);
        const result = await tool.execute("smoke", { account: ACCOUNT, document_id: docId });
        expect(result.details).not.toHaveProperty("error");
        expect(typeof result.details.title).toBe("string");
        return result;
      });
    });
  });

  // -------------------------------------------------------------------------
  // Sheets (1 check — discovers a spreadsheet via Drive search)
  // -------------------------------------------------------------------------
  describe("Sheets", () => {
    it.skipIf(!credentialsExist)("sheets_get — read first available spreadsheet", async () => {
      await smokeCheck("Sheets", "sheets_get", async () => {
        const searchTool = createDriveSearchTool(clientManager);
        const searchResult = await searchTool.execute("smoke", {
          account: ACCOUNT,
          query: "mimeType = 'application/vnd.google-apps.spreadsheet'",
          max_results: 1,
        });

        if (searchResult.details.length === 0) {
          console.warn("[smoke] No Sheets found in Drive — skipping sheets_get read");
          return searchResult;
        }

        const spreadsheetId = searchResult.details[0].id;
        const tool = createSheetsGetTool(clientManager);
        const result = await tool.execute("smoke", {
          account: ACCOUNT,
          spreadsheet_id: spreadsheetId,
          range: "A1:A1",
        });
        expect(result.details).not.toHaveProperty("error");
        return result;
      });
    });
  });

  // -------------------------------------------------------------------------
  // Slides (1 check — discovers a presentation via Drive search)
  // -------------------------------------------------------------------------
  describe("Slides", () => {
    it.skipIf(!credentialsExist)("slides_get — fetch first available presentation", async () => {
      await smokeCheck("Slides", "slides_get", async () => {
        const searchTool = createDriveSearchTool(clientManager);
        const searchResult = await searchTool.execute("smoke", {
          account: ACCOUNT,
          query: "mimeType = 'application/vnd.google-apps.presentation'",
          max_results: 1,
        });

        if (searchResult.details.length === 0) {
          console.warn("[smoke] No Slides found in Drive — skipping slides_get read");
          return searchResult;
        }

        const presId = searchResult.details[0].id;
        const tool = createSlidesGetTool(clientManager);
        const result = await tool.execute("smoke", {
          account: ACCOUNT,
          presentation_id: presId,
        });
        expect(result.details).not.toHaveProperty("error");
        expect(typeof result.details.title).toBe("string");
        return result;
      });
    });
  });

  // -------------------------------------------------------------------------
  // YouTube (5 checks — 2 unauthenticated, 3 authenticated)
  // -------------------------------------------------------------------------
  describe("YouTube", () => {
    it("youtube_get_transcript — public video", async () => {
      const result = await smokeCheck("YouTube", "youtube_get_transcript", async () => {
        const tool = createYouTubeTranscriptTool();
        return tool.execute("smoke", { video: "dQw4w9WgXcQ" });
      });
      expect(result.details).not.toHaveProperty("error");
      expect(result.details.videoId).toBe("dQw4w9WgXcQ");
    });

    it("youtube_thumbnail_reachable — verify CDN responds", async () => {
      await smokeCheck("YouTube", "youtube_thumbnail_reachable", async () => {
        const url = "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
        const res = await fetch(url, { method: "HEAD" });
        expect(res.ok).toBe(true);
        expect(res.headers.get("content-type")).toContain("image");
        return { status: res.status };
      });
    });

    it.skipIf(!credentialsExist)("youtube_search — search for videos", async () => {
      const result = await smokeCheck("YouTube", "youtube_search", async () => {
        const tool = createYouTubeSearchTool(clientManager);
        return tool.execute("smoke", {
          query: "TypeScript tutorial",
          max_results: 1,
          account: ACCOUNT,
        });
      });
      expect(result.details).not.toHaveProperty("error");
      expect(result.details.results.length).toBeGreaterThan(0);
    });

    it.skipIf(!credentialsExist)("youtube_video_details — fetch video metadata", async () => {
      const result = await smokeCheck("YouTube", "youtube_video_details", async () => {
        const tool = createYouTubeVideoDetailsTool(clientManager);
        return tool.execute("smoke", { video: "dQw4w9WgXcQ", account: ACCOUNT });
      });
      expect(result.details).not.toHaveProperty("error");
      expect(result.details.videoId).toBe("dQw4w9WgXcQ");
    });

    it.skipIf(!credentialsExist)("youtube_channel_info — fetch channel info", async () => {
      const result = await smokeCheck("YouTube", "youtube_channel_info", async () => {
        const tool = createYouTubeChannelInfoTool(clientManager);
        return tool.execute("smoke", { channel: "@Google", account: ACCOUNT });
      });
      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.title).toBe("string");
    });
  });

  // =========================================================================
  // WRITE TESTS — create, verify, cleanup
  // =========================================================================

  // -------------------------------------------------------------------------
  // Gmail write: send to self, then trash
  // -------------------------------------------------------------------------
  describe("Gmail (write)", () => {
    it.skipIf(!credentialsExist)("gmail_send + gmail_modify — send and trash", async () => {
      await smokeCheck("Gmail", "gmail_send+trash", async () => {
        const accountsTool = createGmailAccountsTool(clientManager);
        const sendTool = createGmailSendTool(clientManager);
        const modifyTool = createGmailModifyTool(clientManager);

        // Resolve the authenticated email address (Gmail API won't accept "me" as a To header)
        const accountsResult = await accountsTool.execute();
        const myEmail = accountsResult.details.accounts.find(
          (a: { account: string; email: string | null }) => a.account === ACCOUNT,
        )?.email;
        expect(myEmail).toBeTruthy();

        // Send a test email to self
        const sendResult = await sendTool.execute("smoke", {
          account: ACCOUNT,
          to: myEmail,
          subject: `[omniclaw-smoke] ${new Date().toISOString()}`,
          body: "Automated smoke test — this message will be trashed immediately.",
        });
        expect(sendResult.details.success).toBe(true);
        const messageId = sendResult.details.id;

        // Trash it
        const trashResult = await modifyTool.execute("smoke", {
          account: ACCOUNT,
          id: messageId,
          action: "trash",
        });
        expect(trashResult.details.success).toBe(true);
        return trashResult;
      });
    });
  });

  // -------------------------------------------------------------------------
  // Calendar write: create event, then delete
  // -------------------------------------------------------------------------
  describe("Calendar (write)", () => {
    it.skipIf(!credentialsExist)("calendar_create + calendar_delete — create and delete event", async () => {
      await smokeCheck("Calendar", "calendar_create+delete", async () => {
        const createTool = createCalendarCreateTool(clientManager);
        const deleteTool = createCalendarDeleteTool(clientManager);

        // Create an event 1 week from now (avoids cluttering today)
        const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 30 * 60 * 1000);

        const createResult = await createTool.execute("smoke", {
          account: ACCOUNT,
          summary: "[omniclaw-smoke] test event",
          start: start.toISOString(),
          end: end.toISOString(),
        });
        expect(createResult.details.success).toBe(true);
        const eventId = createResult.details.id;

        // Delete it
        const deleteResult = await deleteTool.execute("smoke", {
          account: ACCOUNT,
          event_id: eventId,
        });
        expect(deleteResult.details.success).toBe(true);
        return deleteResult;
      });
    });
  });

  // -------------------------------------------------------------------------
  // Drive write: upload file, download, then permanently delete
  // -------------------------------------------------------------------------
  describe("Drive (write)", () => {
    it.skipIf(!credentialsExist)("drive_upload + drive_download + drive_delete — full cycle", async () => {
      await smokeCheck("Drive", "drive_upload+download+delete", async () => {
        const uploadTool = createDriveUploadTool(clientManager);
        const downloadTool = createDriveDownloadTool(clientManager);
        const deleteTool = createDriveDeleteTool(clientManager);

        // Upload a text file
        const uploadResult = await uploadTool.execute("smoke", {
          account: ACCOUNT,
          name: `omniclaw-smoke-${Date.now()}.txt`,
          content: "Automated smoke test — this file will be deleted immediately.",
          mime_type: "text/plain",
        });
        expect(uploadResult.details.success).toBe(true);
        const fileId = uploadResult.details.id;

        // Download it
        const saveDir = join(tmpdir(), `omniclaw-smoke-${Date.now()}`);
        mkdirSync(saveDir, { recursive: true });
        const downloadResult = await downloadTool.execute("smoke", {
          account: ACCOUNT,
          file_id: fileId,
          save_dir: saveDir,
        });
        expect(downloadResult.details.success).toBe(true);

        // Clean up local file
        try { unlinkSync(downloadResult.details.path); } catch {}

        // Permanently delete from Drive
        const deleteResult = await deleteTool.execute("smoke", {
          account: ACCOUNT,
          file_id: fileId,
          permanent: true,
        });
        expect(deleteResult.details.success).toBe(true);
        return deleteResult;
      });
    });
  });

  // -------------------------------------------------------------------------
  // Docs write: create doc, append text, export PDF, then delete
  // -------------------------------------------------------------------------
  describe("Docs (write)", () => {
    it.skipIf(!credentialsExist)("docs_create + docs_append + docs_export — full cycle", async () => {
      await smokeCheck("Docs", "docs_create+append+export", async () => {
        const createTool = createDocsCreateTool(clientManager);
        const appendTool = createDocsAppendTool(clientManager);
        const exportTool = createDocsExportTool(clientManager);
        const deleteTool = createDriveDeleteTool(clientManager);

        // Create
        const createResult = await createTool.execute("smoke", {
          account: ACCOUNT,
          title: `[omniclaw-smoke] ${new Date().toISOString()}`,
          content: "Smoke test document.",
        });
        expect(createResult.details.success).toBe(true);
        const docId = createResult.details.id;

        // Append
        const appendResult = await appendTool.execute("smoke", {
          account: ACCOUNT,
          document_id: docId,
          text: " Appended text.",
        });
        expect(appendResult.details.success).toBe(true);

        // Export PDF
        const saveDir = join(tmpdir(), `omniclaw-smoke-${Date.now()}`);
        mkdirSync(saveDir, { recursive: true });
        const exportResult = await exportTool.execute("smoke", {
          account: ACCOUNT,
          document_id: docId,
          save_dir: saveDir,
          format: "pdf",
        });
        expect(exportResult.details.success).toBe(true);
        try { unlinkSync(exportResult.details.path); } catch {}

        // Delete via Drive
        const deleteResult = await deleteTool.execute("smoke", {
          account: ACCOUNT,
          file_id: docId,
          permanent: true,
        });
        expect(deleteResult.details.success).toBe(true);
        return deleteResult;
      });
    });
  });

  // -------------------------------------------------------------------------
  // Sheets write: create, update cells, export CSV, then delete
  // -------------------------------------------------------------------------
  describe("Sheets (write)", () => {
    it.skipIf(!credentialsExist)("sheets_create + sheets_update + sheets_export — full cycle", async () => {
      await smokeCheck("Sheets", "sheets_create+update+export", async () => {
        const createTool = createSheetsCreateTool(clientManager);
        const updateTool = createSheetsUpdateTool(clientManager);
        const exportTool = createSheetsExportTool(clientManager);
        const deleteTool = createDriveDeleteTool(clientManager);

        // Create
        const createResult = await createTool.execute("smoke", {
          account: ACCOUNT,
          title: `[omniclaw-smoke] ${new Date().toISOString()}`,
        });
        expect(createResult.details.success).toBe(true);
        const spreadsheetId = createResult.details.id;

        // Update cells
        const updateResult = await updateTool.execute("smoke", {
          account: ACCOUNT,
          spreadsheet_id: spreadsheetId,
          range: "Sheet1!A1:B2",
          values: [["smoke", "test"], ["pass", "ok"]],
        });
        expect(updateResult.details.success).toBe(true);

        // Export CSV
        const saveDir = join(tmpdir(), `omniclaw-smoke-${Date.now()}`);
        mkdirSync(saveDir, { recursive: true });
        const exportResult = await exportTool.execute("smoke", {
          account: ACCOUNT,
          spreadsheet_id: spreadsheetId,
          save_dir: saveDir,
          format: "csv",
        });
        expect(exportResult.details.success).toBe(true);
        try { unlinkSync(exportResult.details.path); } catch {}

        // Delete via Drive
        const deleteResult = await deleteTool.execute("smoke", {
          account: ACCOUNT,
          file_id: spreadsheetId,
          permanent: true,
        });
        expect(deleteResult.details.success).toBe(true);
        return deleteResult;
      });
    });
  });

  // -------------------------------------------------------------------------
  // Slides write: create, append slide, export PDF, then delete
  // -------------------------------------------------------------------------
  describe("Slides (write)", () => {
    it.skipIf(!credentialsExist)("slides_create + slides_append + slides_export — full cycle", async () => {
      await smokeCheck("Slides", "slides_create+append+export", async () => {
        const createTool = createSlidesCreateTool(clientManager);
        const appendTool = createSlidesAppendSlideTool(clientManager);
        const exportTool = createSlidesExportTool(clientManager);
        const deleteTool = createDriveDeleteTool(clientManager);

        // Create
        const createResult = await createTool.execute("smoke", {
          account: ACCOUNT,
          title: `[omniclaw-smoke] ${new Date().toISOString()}`,
        });
        expect(createResult.details.success).toBe(true);
        const presId = createResult.details.id;

        // Append a slide
        const appendResult = await appendTool.execute("smoke", {
          account: ACCOUNT,
          presentation_id: presId,
          title: "Smoke Test Slide",
          body: "This presentation will be deleted immediately.",
        });
        expect(appendResult.details.success).toBe(true);

        // Export PDF
        const saveDir = join(tmpdir(), `omniclaw-smoke-${Date.now()}`);
        mkdirSync(saveDir, { recursive: true });
        const exportResult = await exportTool.execute("smoke", {
          account: ACCOUNT,
          presentation_id: presId,
          save_dir: saveDir,
          format: "pdf",
        });
        expect(exportResult.details.success).toBe(true);
        try { unlinkSync(exportResult.details.path); } catch {}

        // Delete via Drive
        const deleteResult = await deleteTool.execute("smoke", {
          account: ACCOUNT,
          file_id: presId,
          permanent: true,
        });
        expect(deleteResult.details.success).toBe(true);
        return deleteResult;
      });
    });
  });

  // =========================================================================
  // GitHub (5 read checks + 1 write check)
  // =========================================================================

  describe("GitHub", () => {
    let ghManager: GitHubClientManager;

    beforeAll(() => {
      if (githubTokenExists) {
        const store = new ApiKeyStore(join(tmpdir(), `gh-smoke-${Date.now()}.json`));
        store.set("default", GITHUB_TOKEN);
        ghManager = new GitHubClientManager(store);
      }
    });

    it.skipIf(!githubTokenExists)("github_auth_setup — validate token", async () => {
      const result = await smokeCheck("GitHub", "github_auth_setup", async () => {
        const tool = createGitHubAuthSetupTool(ghManager);
        return tool.execute("smoke", { token: GITHUB_TOKEN });
      });
      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.login).toBe("string");
    });

    it.skipIf(!githubTokenExists)("github_repo_list — list repos", async () => {
      const result = await smokeCheck("GitHub", "github_repo_list", async () => {
        const tool = createGitHubRepoListTool(ghManager);
        return tool.execute("smoke", { per_page: 3 });
      });
      expect(Array.isArray(result.details)).toBe(true);
    });

    it.skipIf(!githubTokenExists)("github_repo_get — fetch octocat/Hello-World", async () => {
      const result = await smokeCheck("GitHub", "github_repo_get", async () => {
        const tool = createGitHubRepoGetTool(ghManager);
        return tool.execute("smoke", { owner: "octocat", repo: "Hello-World" });
      });
      expect(result.details).not.toHaveProperty("error");
      expect(result.details.full_name).toBe("octocat/Hello-World");
    });

    it.skipIf(!githubTokenExists)("github_search_repos — search TypeScript", async () => {
      const result = await smokeCheck("GitHub", "github_search_repos", async () => {
        const tool = createGitHubSearchReposTool(ghManager);
        return tool.execute("smoke", { q: "typescript", per_page: 1 });
      });
      expect(result.details.total_count).toBeGreaterThan(0);
    });

    it.skipIf(!githubTokenExists)("github_user_get — fetch octocat profile", async () => {
      const result = await smokeCheck("GitHub", "github_user_get", async () => {
        const tool = createGitHubUserGetTool(ghManager);
        return tool.execute("smoke", { username: "octocat" });
      });
      expect(result.details.login).toBe("octocat");
    });
  });

  describe("GitHub (write)", () => {
    let ghManager: GitHubClientManager;

    beforeAll(() => {
      if (githubTokenExists) {
        const store = new ApiKeyStore(join(tmpdir(), `gh-smoke-write-${Date.now()}.json`));
        store.set("default", GITHUB_TOKEN);
        ghManager = new GitHubClientManager(store);
      }
    });

    it.skipIf(!githubTokenExists)("github_gist_create + github_gist_delete — create and delete", async () => {
      await smokeCheck("GitHub", "gist_create+delete", async () => {
        const createTool = createGitHubGistCreateTool(ghManager);
        const deleteTool = createGitHubGistDeleteTool(ghManager);

        const createResult = await createTool.execute("smoke", {
          description: "[omniclaw-smoke] auto-cleanup",
          public: false,
          files: { "smoke.txt": { content: "Smoke test — will be deleted." } },
        });
        expect(createResult.details).not.toHaveProperty("error");
        const gistId = createResult.details.id;

        const deleteResult = await deleteTool.execute("smoke", { gist_id: gistId });
        expect(deleteResult.details).toMatchObject({ success: true });
        return deleteResult;
      });
    });
  });

  // =========================================================================
  // Wolfram Alpha (2 read checks)
  // =========================================================================

  describe("Wolfram Alpha", () => {
    let wolframManager: WolframClientManager;

    beforeAll(() => {
      if (wolframAppIdExists) {
        const store = new ApiKeyStore(join(tmpdir(), `wolfram-smoke-${Date.now()}.json`));
        store.set("default", WOLFRAM_APPID);
        wolframManager = new WolframClientManager(store);
      }
    });

    it.skipIf(!wolframAppIdExists)("wolfram_query — simple math query", async () => {
      const result = await smokeCheck("Wolfram", "wolfram_query", async () => {
        const tool = createWolframQueryTool(wolframManager);
        return tool.execute("smoke", { input: "2 + 2" });
      });
      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.result).toBe("string");
      expect(result.details.result).toContain("4");
    });

    it.skipIf(!wolframAppIdExists)("wolfram_query_full — structured math query", async () => {
      const result = await smokeCheck("Wolfram", "wolfram_query_full", async () => {
        const tool = createWolframQueryFullTool(wolframManager);
        return tool.execute("smoke", { input: "5!", format: "plaintext" });
      });
      expect(result.details).not.toHaveProperty("error");
      expect(result.details.queryresult.success).toBe(true);
      expect(result.details.queryresult.pods.length).toBeGreaterThan(0);
    });
  });
});
