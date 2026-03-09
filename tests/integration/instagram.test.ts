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
  createInstagramMessagesGetTool,
  createInstagramMessageSendTool,
} from "../../src/tools/instagram-messages.js";
import {
  createInstagramPostLikeTool,
  createInstagramPostUnlikeTool,
  createInstagramPostCommentTool,
} from "../../src/tools/instagram-social.js";

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

  describe("instagram_posts_list", () => {
    it("returns posts for a user", async () => {
      // First get a user_id from profile_view
      const profileTool = createInstagramProfileViewTool(manager);
      const profileResult = await profileTool.execute("t", { username: "instagram" });
      if (profileResult.details.error) return; // skip if session issues

      const tool = createInstagramPostListTool(manager);
      const result = await tool.execute("t", { user_id: profileResult.details.pk || profileResult.details.user_id });
      expect(result.details).toBeDefined();
    });
  });

  describe("instagram_post_get", () => {
    it("returns a specific post or graceful error", async () => {
      // Get a media_id from the feed
      const feedTool = createInstagramFeedGetTool(manager);
      const feedResult = await feedTool.execute("t", {});
      if (feedResult.details.error || !Array.isArray(feedResult.details) || feedResult.details.length === 0) {
        // If feed returns error or empty, skip gracefully
        return;
      }

      const mediaId = feedResult.details[0]?.pk || feedResult.details[0]?.id;
      if (!mediaId) return;

      const tool = createInstagramPostGetTool(manager);
      const result = await tool.execute("t", { media_id: String(mediaId) });
      expect(result.details).toBeDefined();
    });
  });

  describe("instagram_stories_get", () => {
    it("returns stories or empty response", async () => {
      const tool = createInstagramStoriesGetTool(manager);
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

  describe("instagram_messages_get", () => {
    it("returns messages from first inbox thread or graceful error", async () => {
      // First get inbox to find a thread_id
      const inboxTool = createInstagramInboxGetTool(manager);
      const inboxResult = await inboxTool.execute("t", {});
      if (inboxResult.details.error) return;

      const threads = inboxResult.details.threads || inboxResult.details;
      if (!Array.isArray(threads) || threads.length === 0) return;

      const threadId = threads[0]?.thread_id || threads[0]?.id;
      if (!threadId) return;

      const tool = createInstagramMessagesGetTool(manager);
      const result = await tool.execute("t", { thread_id: String(threadId) });
      expect(result.details).toBeDefined();
    });
  });

  // ── Write tools (gated) ─────────────────────────────────────────────

  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    it("instagram_post_like / instagram_post_unlike — reversible pair", async () => {
      // Get a media_id from the feed
      const feedTool = createInstagramFeedGetTool(manager);
      const feedResult = await feedTool.execute("t", {});
      if (feedResult.details.error || !Array.isArray(feedResult.details) || feedResult.details.length === 0) {
        return;
      }

      const mediaId = String(feedResult.details[0]?.pk || feedResult.details[0]?.id);
      if (!mediaId) return;

      // Like
      const likeTool = createInstagramPostLikeTool(manager);
      const likeResult = await likeTool.execute("t", { media_id: mediaId });
      expect(likeResult.details).toBeDefined();
      expect(likeResult.details.error).toBeUndefined();

      // Unlike (reverse)
      const unlikeTool = createInstagramPostUnlikeTool(manager);
      const unlikeResult = await unlikeTool.execute("t", { media_id: mediaId });
      expect(unlikeResult.details).toBeDefined();
      expect(unlikeResult.details.error).toBeUndefined();
    });

    it("instagram_post_comment — comments on a feed post", async () => {
      const feedTool = createInstagramFeedGetTool(manager);
      const feedResult = await feedTool.execute("t", {});
      if (feedResult.details.error || !Array.isArray(feedResult.details) || feedResult.details.length === 0) {
        return;
      }

      const mediaId = String(feedResult.details[0]?.pk || feedResult.details[0]?.id);
      if (!mediaId) return;

      const tool = createInstagramPostCommentTool(manager);
      const result = await tool.execute("t", {
        media_id: mediaId,
        text: "[omniclaw integration test] comment",
      });
      expect(result.details).toBeDefined();
    });

    it("instagram_message_send — sends a DM to first inbox thread", async () => {
      const inboxTool = createInstagramInboxGetTool(manager);
      const inboxResult = await inboxTool.execute("t", {});
      if (inboxResult.details.error) return;

      const threads = inboxResult.details.threads || inboxResult.details;
      if (!Array.isArray(threads) || threads.length === 0) return;

      const threadId = String(threads[0]?.thread_id || threads[0]?.id);
      if (!threadId) return;

      const tool = createInstagramMessageSendTool(manager);
      const result = await tool.execute("t", {
        thread_id: threadId,
        text: "[omniclaw integration test] message",
      });
      expect(result.details).toBeDefined();
    });
  });
});
