/**
 * Hourly smoke tests — read-only health checks for all omniclaw integrations.
 *
 * Run via:  pnpm test:smoke
 *
 * Every check is read-only. No resources are created, modified, or deleted.
 * Designed to complete in under 60 seconds total.
 *
 * Environment variables (same as regular integration tests):
 *   CLIENT_SECRET_PATH   path to client_secret.json  (default: ~/.openclaw/client_secret.json)
 *   TOKENS_PATH          path to omniclaw-tokens.json (default: ~/.openclaw/omniclaw-tokens.json)
 *   SMOKE_LOG_DIR        directory for JSON result logs (default: ~/.openclaw/smoke-logs)
 */

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { homedir } from "os";
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

describe("Omniclaw Smoke Tests", { timeout: 60_000 }, () => {
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
});
