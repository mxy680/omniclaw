/**
 * Integration tests — hit the real Instagram API.
 *
 * Requires an authenticated session at:
 *   ~/.openclaw/instagram-sessions.json
 *
 * Run `instagram_auth_setup` first to create the session.
 *
 * Write tests are skipped unless:
 *   RUN_WRITE_TESTS=1    enable like, unlike, comment, message tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { SessionStore } from "../../src/auth/session-store.js";
import { InstagramClientManager } from "../../src/auth/instagram-client-manager.js";

import {
  createInstagramProfileGetTool,
  createInstagramProfileViewTool,
} from "../../src/tools/instagram-profile.js";
import {
  createInstagramFeedGetTool,
  createInstagramPostListTool,
  createInstagramPostGetTool,
} from "../../src/tools/instagram-feed.js";
import { createInstagramSearchTool } from "../../src/tools/instagram-search.js";
import { createInstagramStoriesGetTool } from "../../src/tools/instagram-stories.js";
import {
  createInstagramInboxGetTool,
} from "../../src/tools/instagram-messages.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SESSIONS_PATH =
  process.env.INSTAGRAM_SESSIONS_PATH ??
  join(homedir(), ".openclaw", "instagram-sessions.json");
const credentialsExist = existsSync(SESSIONS_PATH);
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

describe.skipIf(!credentialsExist)("Instagram integration", { timeout: 30_000 }, () => {
  let manager: InstagramClientManager;

  beforeAll(() => {
    const sessionStore = new SessionStore(SESSIONS_PATH);
    manager = new InstagramClientManager(sessionStore);
  });

  // ── Read-only tools ─────────────────────────────────────────────────

  describe("instagram_profile_get", () => {
    it("returns the authenticated user profile", async () => {
      const tool = createInstagramProfileGetTool(manager);
      const result = await tool.execute("t", {});
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("instagram_profile_view", () => {
    it("returns a public profile", async () => {
      const tool = createInstagramProfileViewTool(manager);
      const result = await tool.execute("t", { username: "instagram" });
      expect(result.details).toBeDefined();
    });
  });

  describe("instagram_search", () => {
    it("returns search results", async () => {
      const tool = createInstagramSearchTool(manager);
      const result = await tool.execute("t", { query: "nature" });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("instagram_feed_get", () => {
    it("returns timeline feed", async () => {
      const tool = createInstagramFeedGetTool(manager);
      const result = await tool.execute("t", {});
      expect(result.details).toBeDefined();
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });

  describe("instagram_inbox_get", () => {
    it("returns DM inbox or graceful error", async () => {
      const tool = createInstagramInboxGetTool(manager);
      const result = await tool.execute("t", {});
      expect(result.details).toBeDefined();
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });
});
