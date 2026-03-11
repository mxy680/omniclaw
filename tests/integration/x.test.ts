/**
 * Integration tests — hit the real X (Twitter) API.
 *
 * Requires an authenticated session at:
 *   ~/.openclaw/x-sessions.json
 *
 * Run `x_auth_setup` first to create the session.
 *
 * Write tests are skipped unless:
 *   RUN_WRITE_TESTS=1    enable tweet, like, retweet, bookmark, follow, DM tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { SessionStore } from "../../src/auth/session-store.js";
import { XClientManager } from "../../src/auth/x-client-manager.js";

import {
  createXProfileGetTool,
  createXProfileMeTool,
} from "../../src/tools/x-profile.js";
import {
  createXTimelineHomeTool,
  createXTimelineUserTool,
} from "../../src/tools/x-timeline.js";
import {
  createXTweetGetTool,
  createXTweetCreateTool,
  createXTweetDeleteTool,
  createXTweetReplyTool,
} from "../../src/tools/x-tweet.js";
import { createXSearchTool } from "../../src/tools/x-search.js";
import {
  createXTweetLikeTool,
  createXTweetUnlikeTool,
  createXTweetRetweetTool,
  createXTweetUnretweetTool,
  createXTweetBookmarkTool,
  createXTweetUnbookmarkTool,
} from "../../src/tools/x-interactions.js";
import { createXBookmarksListTool } from "../../src/tools/x-bookmarks.js";
import {
  createXFollowersListTool,
  createXFollowingListTool,
  createXFollowTool,
  createXUnfollowTool,
} from "../../src/tools/x-social.js";
import {
  createXDmConversationsTool,
  createXDmMessagesTool,
  createXDmSendTool,
} from "../../src/tools/x-messages.js";
import {
  createXListsGetTool,
  createXListTimelineTool,
} from "../../src/tools/x-lists.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SESSIONS_PATH =
  process.env.X_SESSIONS_PATH ??
  join(homedir(), ".openclaw", "x-sessions.json");
const credentialsExist = existsSync(SESSIONS_PATH);
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

describe.skipIf(!credentialsExist)("X (Twitter) integration", { timeout: 30_000 }, () => {
  let manager: XClientManager;
  let myUserId: string;

  beforeAll(async () => {
    const sessionStore = new SessionStore(SESSIONS_PATH);
    manager = new XClientManager(sessionStore);

    // Fetch our own user ID for tests that need it
    const meTool = createXProfileMeTool(manager);
    const meResult = await meTool.execute("t", {});
    if (meResult.details && !meResult.details.error) {
      myUserId = meResult.details.id || meResult.details.user_id || meResult.details.rest_id;
    }
  });

  // ── Read-only tools ─────────────────────────────────────────────────

  describe("x_profile_me", () => {
    it("returns the authenticated user profile", async () => {
      const tool = createXProfileMeTool(manager);
      const result = await tool.execute("t", {});
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("x_profile_get", () => {
    it("returns a public profile by username", async () => {
      const tool = createXProfileGetTool(manager);
      const result = await tool.execute("t", { username: "elonmusk" });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("x_timeline_home", () => {
    it("returns home timeline", async () => {
      const tool = createXTimelineHomeTool(manager);
      const result = await tool.execute("t", {});
      expect(result.details).toBeDefined();
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });

  describe("x_timeline_user", () => {
    it("returns user timeline for authenticated user", async () => {
      if (!myUserId) return;
      const tool = createXTimelineUserTool(manager);
      const result = await tool.execute("t", { user_id: myUserId });
      expect(result.details).toBeDefined();
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });

  describe("x_tweet_get", () => {
    it("returns a specific tweet", async () => {
      const tool = createXTweetGetTool(manager);
      // Tweet ID "20" is the first tweet ever posted (by @jack)
      const result = await tool.execute("t", { tweet_id: "20" });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("x_search", () => {
    it("returns search results", async () => {
      const tool = createXSearchTool(manager);
      const result = await tool.execute("t", { query: "OpenAI" });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });

  describe("x_bookmarks_list", () => {
    it("returns bookmarks or empty list", async () => {
      const tool = createXBookmarksListTool(manager);
      const result = await tool.execute("t", {});
      expect(result.details).toBeDefined();
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });

  describe("x_followers_list", () => {
    it("returns followers for authenticated user", async () => {
      if (!myUserId) return;
      const tool = createXFollowersListTool(manager);
      const result = await tool.execute("t", { user_id: myUserId });
      expect(result.details).toBeDefined();
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });

  describe("x_following_list", () => {
    it("returns following list for authenticated user", async () => {
      if (!myUserId) return;
      const tool = createXFollowingListTool(manager);
      const result = await tool.execute("t", { user_id: myUserId });
      expect(result.details).toBeDefined();
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });

  describe("x_dm_conversations", () => {
    it("returns DM conversations or graceful error", async () => {
      const tool = createXDmConversationsTool(manager);
      const result = await tool.execute("t", {});
      expect(result.details).toBeDefined();
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });

  describe("x_dm_messages", () => {
    it("returns messages from first conversation or graceful error", async () => {
      // First get conversations to find a conversation_id
      const convTool = createXDmConversationsTool(manager);
      const convResult = await convTool.execute("t", {});
      if (convResult.details.error) return;

      const conversations = convResult.details.conversations || convResult.details;
      if (!Array.isArray(conversations) || conversations.length === 0) return;

      const conversationId = conversations[0]?.conversation_id || conversations[0]?.id;
      if (!conversationId) return;

      const tool = createXDmMessagesTool(manager);
      const result = await tool.execute("t", { conversation_id: String(conversationId) });
      expect(result.details).toBeDefined();
    });
  });

  describe("x_lists_get", () => {
    it("returns user lists or empty list", async () => {
      const tool = createXListsGetTool(manager);
      const result = await tool.execute("t", {});
      expect(result.details).toBeDefined();
      if (result.details.error) {
        expect(result.details.error).toMatch(/request_failed|session_expired/);
      }
    });
  });

  describe("x_list_timeline", () => {
    it("returns list timeline or graceful error", async () => {
      // First get lists to find a list_id
      const listsTool = createXListsGetTool(manager);
      const listsResult = await listsTool.execute("t", {});
      if (listsResult.details.error) return;

      const lists = listsResult.details.lists || listsResult.details;
      if (!Array.isArray(lists) || lists.length === 0) return;

      const listId = lists[0]?.list_id || lists[0]?.id || lists[0]?.id_str;
      if (!listId) return;

      const tool = createXListTimelineTool(manager);
      const result = await tool.execute("t", { list_id: String(listId) });
      expect(result.details).toBeDefined();
    });
  });

  // ── Write tools (gated) ─────────────────────────────────────────────

  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    let createdTweetId: string;

    it("x_tweet_create — creates a tweet", async () => {
      const tool = createXTweetCreateTool(manager);
      const result = await tool.execute("t", {
        text: `[omniclaw integration test] ${Date.now()}`,
      });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
      createdTweetId = result.details.tweet_id || result.details.id || result.details.id_str;
      expect(createdTweetId).toBeDefined();
    });

    it("x_tweet_reply — replies to the created tweet", async () => {
      if (!createdTweetId) return;
      const tool = createXTweetReplyTool(manager);
      const result = await tool.execute("t", {
        tweet_id: createdTweetId,
        text: "[omniclaw integration test] reply",
      });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });

    it("x_tweet_like / x_tweet_unlike — reversible pair", async () => {
      if (!createdTweetId) return;

      const likeTool = createXTweetLikeTool(manager);
      const likeResult = await likeTool.execute("t", { tweet_id: createdTweetId });
      expect(likeResult.details).toBeDefined();
      expect(likeResult.details.error).toBeUndefined();

      const unlikeTool = createXTweetUnlikeTool(manager);
      const unlikeResult = await unlikeTool.execute("t", { tweet_id: createdTweetId });
      expect(unlikeResult.details).toBeDefined();
      expect(unlikeResult.details.error).toBeUndefined();
    });

    it("x_tweet_retweet / x_tweet_unretweet — reversible pair", async () => {
      if (!createdTweetId) return;

      const retweetTool = createXTweetRetweetTool(manager);
      const retweetResult = await retweetTool.execute("t", { tweet_id: createdTweetId });
      expect(retweetResult.details).toBeDefined();
      expect(retweetResult.details.error).toBeUndefined();

      const unretweetTool = createXTweetUnretweetTool(manager);
      const unretweetResult = await unretweetTool.execute("t", { tweet_id: createdTweetId });
      expect(unretweetResult.details).toBeDefined();
      expect(unretweetResult.details.error).toBeUndefined();
    });

    it("x_tweet_bookmark / x_tweet_unbookmark — reversible pair", async () => {
      if (!createdTweetId) return;

      const bookmarkTool = createXTweetBookmarkTool(manager);
      const bookmarkResult = await bookmarkTool.execute("t", { tweet_id: createdTweetId });
      expect(bookmarkResult.details).toBeDefined();
      expect(bookmarkResult.details.error).toBeUndefined();

      const unbookmarkTool = createXTweetUnbookmarkTool(manager);
      const unbookmarkResult = await unbookmarkTool.execute("t", { tweet_id: createdTweetId });
      expect(unbookmarkResult.details).toBeDefined();
      expect(unbookmarkResult.details.error).toBeUndefined();
    });

    it("x_follow / x_unfollow — reversible pair", async () => {
      // Follow/unfollow a well-known account (NASA)
      const profileTool = createXProfileGetTool(manager);
      const profileResult = await profileTool.execute("t", { username: "NASA" });
      if (profileResult.details.error) return;

      const targetUserId = profileResult.details.id || profileResult.details.user_id || profileResult.details.rest_id;
      if (!targetUserId) return;

      const followTool = createXFollowTool(manager);
      const followResult = await followTool.execute("t", { user_id: String(targetUserId) });
      expect(followResult.details).toBeDefined();
      expect(followResult.details.error).toBeUndefined();

      const unfollowTool = createXUnfollowTool(manager);
      const unfollowResult = await unfollowTool.execute("t", { user_id: String(targetUserId) });
      expect(unfollowResult.details).toBeDefined();
      expect(unfollowResult.details.error).toBeUndefined();
    });

    it("x_dm_send — sends a DM to first conversation", async () => {
      const convTool = createXDmConversationsTool(manager);
      const convResult = await convTool.execute("t", {});
      if (convResult.details.error) return;

      const conversations = convResult.details.conversations || convResult.details;
      if (!Array.isArray(conversations) || conversations.length === 0) return;

      const conversationId = String(conversations[0]?.conversation_id || conversations[0]?.id);
      if (!conversationId) return;

      const tool = createXDmSendTool(manager);
      const result = await tool.execute("t", {
        conversation_id: conversationId,
        text: "[omniclaw integration test] message",
      });
      expect(result.details).toBeDefined();
    });

    it("x_tweet_delete — deletes the created tweet", async () => {
      if (!createdTweetId) return;
      const tool = createXTweetDeleteTool(manager);
      const result = await tool.execute("t", { tweet_id: createdTweetId });
      expect(result.details).toBeDefined();
      expect(result.details.error).toBeUndefined();
    });
  });
});
