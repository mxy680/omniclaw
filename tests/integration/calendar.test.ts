/**
 * Integration tests — hit the real Google Calendar API.
 *
 * Uses the same credentials as Gmail (shared OAuth flow).
 *
 * Required env vars (or fall back to detected defaults):
 *   CLIENT_SECRET_PATH   path to client_secret.json
 *   TOKENS_PATH          path to omniclaw-tokens.json  (default: ~/.openclaw/omniclaw-tokens.json)
 *   GMAIL_ACCOUNT        token store account name       (default: "default")
 *
 * Write tests are skipped unless:
 *   RUN_WRITE_TESTS=1    enable create / get / update / respond / delete tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { OAuthClientManager } from "../../src/auth/oauth-client-manager";
import { TokenStore } from "../../src/auth/token-store";
import { createCalendarListCalendarsTool } from "../../src/tools/calendar-list-calendars";
import { createCalendarEventsTool } from "../../src/tools/calendar-events";
import { createCalendarGetTool } from "../../src/tools/calendar-get";
import { createCalendarCreateTool } from "../../src/tools/calendar-create";
import { createCalendarUpdateTool } from "../../src/tools/calendar-update";
import { createCalendarDeleteTool } from "../../src/tools/calendar-delete";
import { createCalendarRespondTool } from "../../src/tools/calendar-respond";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CLIENT_SECRET_PATH =
  process.env.CLIENT_SECRET_PATH ??
  "/Users/markshteyn/Downloads/client_secret_772791512967-bb4nvpsu9umlr74nt12cjvloaq6hcale.apps.googleusercontent.com.json";

const TOKENS_PATH =
  process.env.TOKENS_PATH ??
  join(homedir(), ".openclaw", "omniclaw-tokens.json");

const ACCOUNT = process.env.GMAIL_ACCOUNT ?? "default";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

const credentialsExist =
  existsSync(CLIENT_SECRET_PATH) && existsSync(TOKENS_PATH);

if (!credentialsExist) {
  console.warn(
    "\n[integration] Skipping: credentials not found.\n" +
    `  CLIENT_SECRET_PATH=${CLIENT_SECRET_PATH}\n` +
    `  TOKENS_PATH=${TOKENS_PATH}\n`
  );
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let clientManager: OAuthClientManager;
let createdEventId: string; // set by calendar_create, reused by get/update/respond/delete

// ---------------------------------------------------------------------------
describe.skipIf(!credentialsExist)("Google Calendar API integration", { timeout: 30_000 }, () => {

  beforeAll(() => {
    const tokenStore = new TokenStore(TOKENS_PATH);
    clientManager = new OAuthClientManager(CLIENT_SECRET_PATH, 9753, tokenStore);
  });

  // -------------------------------------------------------------------------
  // calendar_list_calendars
  // -------------------------------------------------------------------------
  describe("calendar_list_calendars", () => {
    it("returns at least one calendar with required fields", async () => {
      const tool = createCalendarListCalendarsTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeGreaterThan(0);

      const cal = result.details[0];
      expect(typeof cal.id).toBe("string");
      expect(typeof cal.summary).toBe("string");
      expect(typeof cal.primary).toBe("boolean");
    });

    it("includes a primary calendar", async () => {
      const tool = createCalendarListCalendarsTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      const primary = result.details.find((c: { primary: boolean }) => c.primary);
      expect(primary).toBeDefined();
      // For Google accounts, the primary calendar id is the user's email
      expect(primary.id).toContain("@");
    });
  });

  // -------------------------------------------------------------------------
  // calendar_events
  // -------------------------------------------------------------------------
  describe("calendar_events", () => {
    it("returns an array with correct field shapes", async () => {
      const tool = createCalendarEventsTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, max_results: 5 });

      expect(Array.isArray(result.details)).toBe(true);

      if (result.details.length > 0) {
        const ev = result.details[0];
        expect(typeof ev.id).toBe("string");
        expect(typeof ev.summary).toBe("string");
        expect(typeof ev.start).toBe("string");
        expect(typeof ev.end).toBe("string");
        expect(typeof ev.status).toBe("string");
        expect(Array.isArray(ev.attendees)).toBe(true);
      }
    });

    it("respects max_results", async () => {
      const tool = createCalendarEventsTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, max_results: 2 });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details.length).toBeLessThanOrEqual(2);
    });

    it("returns no events for a time range in the past", async () => {
      const tool = createCalendarEventsTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        time_min: "2000-01-01T00:00:00Z",
        time_max: "2000-01-02T00:00:00Z",
      });

      expect(Array.isArray(result.details)).toBe(true);
      expect(result.details).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Write tests — opt-in via RUN_WRITE_TESTS=1
  // -------------------------------------------------------------------------
  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {

    it("calendar_create — creates a test event and returns its ID", async () => {
      const selfEmail = await getSelfEmail();
      const tool = createCalendarCreateTool(clientManager);

      const start = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
      const end = new Date(start.getTime() + 60 * 60 * 1000);   // +1 hour

      const result = await tool.execute("t", {
        account: ACCOUNT,
        summary: "[omniclaw integration test] calendar_create",
        start: start.toISOString(),
        end: end.toISOString(),
        description: "Automated integration test. Safe to delete.",
        attendees: [selfEmail],
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.id).toBe("string");
      expect(result.details.id.length).toBeGreaterThan(0);
      expect(typeof result.details.htmlLink).toBe("string");

      createdEventId = result.details.id;
    });

    it("calendar_get — fetches the created event with correct fields", async () => {
      expect(createdEventId).toBeTruthy();

      const tool = createCalendarGetTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, event_id: createdEventId });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.id).toBe(createdEventId);
      expect(result.details.summary).toBe("[omniclaw integration test] calendar_create");
      expect(typeof result.details.start).toBe("string");
      expect(typeof result.details.end).toBe("string");
      expect(Array.isArray(result.details.attendees)).toBe(true);
    });

    it("calendar_update — updates the event summary", async () => {
      expect(createdEventId).toBeTruthy();

      const tool = createCalendarUpdateTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        event_id: createdEventId,
        summary: "[omniclaw integration test] calendar_update",
      });

      expect(result.details.success).toBe(true);
      expect(result.details.summary).toBe("[omniclaw integration test] calendar_update");
    });

    it("calendar_respond — RSVPs to the event as tentative", async () => {
      expect(createdEventId).toBeTruthy();

      const tool = createCalendarRespondTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        event_id: createdEventId,
        response: "tentative",
      });

      expect(result.details.success).toBe(true);
      expect(result.details.response).toBe("tentative");
    });

    it("calendar_delete — deletes the test event", async () => {
      expect(createdEventId).toBeTruthy();

      const tool = createCalendarDeleteTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, event_id: createdEventId });

      expect(result.details.success).toBe(true);
      expect(result.details.event_id).toBe(createdEventId);
    });

    it("calendar_get — confirms the deleted event is cancelled", async () => {
      expect(createdEventId).toBeTruthy();

      const tool = createCalendarGetTool(clientManager);
      const result = await tool.execute("t", { account: ACCOUNT, event_id: createdEventId });

      // Google Calendar returns the event with status "cancelled" after deletion
      expect(result.details.id).toBe(createdEventId);
      expect(result.details.status).toBe("cancelled");
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
