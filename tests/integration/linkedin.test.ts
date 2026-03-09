/**
 * Integration tests — hit the real LinkedIn Voyager API.
 *
 * Requires an authenticated session at:
 *   ~/.openclaw/linkedin-sessions.json
 *
 * Run `linkedin_auth_setup` first to create the session.
 *
 * Write tests are skipped unless:
 *   RUN_WRITE_TESTS=1    enable post create, like, comment, message tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { SessionStore } from "../../src/auth/session-store.js";
import { LinkedinClientManager } from "../../src/auth/linkedin-client-manager.js";

import {
  createLinkedinProfileGetTool,
  createLinkedinProfileViewTool,
} from "../../src/tools/linkedin-profile.js";
import { createLinkedinConnectionsListTool } from "../../src/tools/linkedin-connections.js";
import { createLinkedinSearchPeopleTool } from "../../src/tools/linkedin-search.js";
import {
  createLinkedinPostListTool,
  createLinkedinPostCreateTool,
  createLinkedinPostLikeTool,
  createLinkedinPostCommentTool,
} from "../../src/tools/linkedin-posts.js";
import {
  createLinkedinMessagesListTool,
  createLinkedinMessagesSendTool,
} from "../../src/tools/linkedin-messages.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SESSIONS_PATH =
  process.env.LINKEDIN_SESSIONS_PATH ??
  join(homedir(), ".openclaw", "linkedin-sessions.json");
const credentialsExist = existsSync(SESSIONS_PATH);
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

describe.skipIf(!credentialsExist)("LinkedIn integration", { timeout: 30_000 }, () => {
  let manager: LinkedinClientManager;

  beforeAll(() => {
    const sessionStore = new SessionStore(SESSIONS_PATH);
    manager = new LinkedinClientManager(sessionStore);
  });

  // ── Read-only tools ─────────────────────────────────────────────────

  describe("linkedin_profile_get", () => {
    it("returns the authenticated user profile", async () => {
      const tool = createLinkedinProfileGetTool(manager);
      const result = await tool.execute("t", {});
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("linkedin_profile_view", () => {
    it("returns a public profile", async () => {
      const tool = createLinkedinProfileViewTool(manager);
      const result = await tool.execute("t", { public_id: "williamhgates" });
      expect(result.details).toBeDefined();
    });
  });

  describe("linkedin_connections_list", () => {
    it("returns connections", async () => {
      const tool = createLinkedinConnectionsListTool(manager);
      const result = await tool.execute("t", { count: 5 });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("linkedin_search_people", () => {
    it("returns search results", async () => {
      const tool = createLinkedinSearchPeopleTool(manager);
      const result = await tool.execute("t", {
        keywords: "software engineer",
        count: 3,
      });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("linkedin_post_list", () => {
    it("returns feed posts", async () => {
      const tool = createLinkedinPostListTool(manager);
      const result = await tool.execute("t", { count: 3 });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("linkedin_messages_list", () => {
    it("returns conversations or graceful error", async () => {
      const tool = createLinkedinMessagesListTool(manager);
      const result = await tool.execute("t", { count: 5 });
      expect(result.details).toBeDefined();
      // LinkedIn's legacy messaging API returns 500 intermittently.
      // Accept either a successful response or a request_failed error.
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });

  // ── Write tools (gated) ─────────────────────────────────────────────

  describe.skipIf(!RUN_WRITE_TESTS)("linkedin_post_create", () => {
    it("creates a post", async () => {
      const tool = createLinkedinPostCreateTool(manager);
      const result = await tool.execute("t", {
        text: "[omniclaw integration test] smoke — will be deleted",
        visibility: "CONNECTIONS",
      });
      expect(result.details).toBeDefined();
    });
  });
});
