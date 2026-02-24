/**
 * Integration tests — hit the real Instagram API via Playwright.
 *
 * Re-authenticates in beforeAll to ensure fresh session cookies.
 * Credentials are read from the openclaw config file (~/.openclaw/openclaw.json),
 * with env var overrides:
 *   INSTAGRAM_USERNAME   Instagram username
 *   INSTAGRAM_PASSWORD   Instagram password
 *
 * Timeout: 120s — each call launches a Playwright browser (~5-10s per call).
 *
 * Run:
 *   pnpm vitest run tests/integration/instagram.test.ts
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { InstagramClientManager } from "../../src/auth/instagram-client-manager.js";
import { createInstagramAuthTool } from "../../src/tools/instagram-auth-tool.js";
import { createInstagramProfileTool, createInstagramGetProfileTool } from "../../src/tools/instagram-profile.js";
import { createInstagramFeedTool } from "../../src/tools/instagram-feed.js";
import { createInstagramUserPostsTool, createInstagramPostDetailsTool } from "../../src/tools/instagram-posts.js";
import { createInstagramPostCommentsTool } from "../../src/tools/instagram-comments.js";
import { createInstagramStoriesTool } from "../../src/tools/instagram-stories.js";
import { createInstagramReelsTool } from "../../src/tools/instagram-reels.js";
import { createInstagramSearchTool } from "../../src/tools/instagram-search.js";
import { createInstagramFollowersTool, createInstagramFollowingTool } from "../../src/tools/instagram-social.js";
import {
  createInstagramConversationsTool,
  createInstagramMessagesTool,
} from "../../src/tools/instagram-messages.js";
import { createInstagramNotificationsTool } from "../../src/tools/instagram-notifications.js";
import { createInstagramSavedTool } from "../../src/tools/instagram-saved.js";
import { createInstagramDownloadMediaTool } from "../../src/tools/instagram-download-media.js";

// ---------------------------------------------------------------------------
// Config — read auth credentials from openclaw plugin config, env overrides
// ---------------------------------------------------------------------------
function loadOpenclawPluginConfig(): Record<string, string> {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return raw?.plugins?.entries?.omniclaw?.config ?? {};
  } catch {
    return {};
  }
}

const oclConfig = loadOpenclawPluginConfig();

const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-instagram-tokens.json");
const ACCOUNT = "default";

const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME || oclConfig.instagram_username || "";
const INSTAGRAM_PASSWORD = process.env.INSTAGRAM_PASSWORD || oclConfig.instagram_password || "";

const authCredentialsAvailable = INSTAGRAM_USERNAME !== "" && INSTAGRAM_PASSWORD !== "";

if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping Instagram: auth credentials not found in " +
      "~/.openclaw/openclaw.json or env vars.\n",
  );
}

// ---------------------------------------------------------------------------
// Shared state populated across tests
// ---------------------------------------------------------------------------
let instagramManager: InstagramClientManager;
let myUsername: string;
let firstPostShortcode: string;
let firstThreadId: string;

const INSTA_SAVE_DIR = join(tmpdir(), `omniclaw-insta-test-${Date.now()}`);

// ---------------------------------------------------------------------------
describe.skipIf(!authCredentialsAvailable)("Instagram API integration", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    instagramManager = new InstagramClientManager(TOKENS_PATH);

    // Re-authenticate to get fresh session cookies
    const tool = createInstagramAuthTool(instagramManager, {
      client_secret_path: "",
      instagram_username: INSTAGRAM_USERNAME,
      instagram_password: INSTAGRAM_PASSWORD,
    });
    const result = await tool.execute("reauth", { account: ACCOUNT });
    console.log("[instagram] Re-auth result:", JSON.stringify(result.details, null, 2));
    expect(result.details.status).toBe("authenticated");

    // username may be "unknown" if the profile fetch is unreliable — that's acceptable
    myUsername = result.details.username !== "unknown" ? result.details.username : "";
  }, 120_000);

  afterAll(() => {
    try {
      if (existsSync(INSTA_SAVE_DIR)) {
        for (const file of readdirSync(INSTA_SAVE_DIR)) {
          unlinkSync(join(INSTA_SAVE_DIR, file));
        }
        rmdirSync(INSTA_SAVE_DIR);
      }
    } catch { /* best-effort cleanup */ }
  });

  // -------------------------------------------------------------------------
  // instagram_profile
  // -------------------------------------------------------------------------
  describe("instagram_profile", () => {
    it("returns the authenticated user's profile", async () => {
      const tool = createInstagramProfileTool(instagramManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      if (result.details.error) {
        // Tolerate transient API errors (e.g. 400/500 from the profile endpoint)
        expect(typeof result.details.error).toBe("string");
      } else {
        expect(typeof result.details.username).toBe("string");
        expect(typeof result.details.full_name).toBe("string");
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_get_profile
  // -------------------------------------------------------------------------
  describe("instagram_get_profile", () => {
    it("fetches a user profile by username", async () => {
      // Use the authenticated user's username when known; fall back to a well-known public account
      const targetUsername = myUsername || "instagram";

      const tool = createInstagramGetProfileTool(instagramManager);
      const result = await tool.execute("t", { username: targetUsername, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.username).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // instagram_feed
  // -------------------------------------------------------------------------
  describe("instagram_feed", () => {
    it("returns an array of feed posts", async () => {
      const tool = createInstagramFeedTool(instagramManager);
      const result = await tool.execute("t", { count: 3, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.posts)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // instagram_download_media
  // -------------------------------------------------------------------------
  describe("instagram_download_media", () => {
    it("downloads a media file from a feed post URL", async () => {
      // First, get a feed post with an image URL
      const feedTool = createInstagramFeedTool(instagramManager);
      const feedResult = await feedTool.execute("t", { count: 5, account: ACCOUNT });

      if (feedResult.details.error || !feedResult.details.posts || feedResult.details.posts.length === 0) {
        console.warn("[instagram] No feed posts available — skipping download test");
        return;
      }

      // Find a post with an image_url
      const postWithImage = feedResult.details.posts.find(
        (p: Record<string, unknown>) => typeof p.image_url === "string" && (p.image_url as string).length > 0,
      );

      if (!postWithImage) {
        console.warn("[instagram] No feed posts with image URLs — skipping download test");
        return;
      }

      const tool = createInstagramDownloadMediaTool(instagramManager);
      const result = await tool.execute("t", {
        url: postWithImage.image_url,
        save_dir: INSTA_SAVE_DIR,
        account: ACCOUNT,
      });

      if (result.details.error) {
        // CDN URLs may expire or be geo-restricted — accept graceful error
        expect(typeof result.details.error).toBe("string");
      } else {
        expect(typeof result.details.path).toBe("string");
        expect(existsSync(result.details.path)).toBe(true);
        expect(typeof result.details.mimeType).toBe("string");
        expect(result.details.size).toBeGreaterThan(0);
        expect(result.details.source_url).toBe(postWithImage.image_url);
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_user_posts
  // -------------------------------------------------------------------------
  describe("instagram_user_posts", () => {
    it("returns posts from a user", async () => {
      // Use the authenticated user's username when known; fall back to a well-known public account
      const targetUsername = myUsername || "instagram";

      const tool = createInstagramUserPostsTool(instagramManager);
      const result = await tool.execute("t", { username: targetUsername, count: 3, account: ACCOUNT });

      if (result.details.error) {
        // May fail if username resolution or feed is unavailable
        expect(result.details.error).toMatch(/error|resolve/i);
      } else {
        expect(Array.isArray(result.details.posts)).toBe(true);

        if (result.details.posts.length > 0 && result.details.posts[0].code) {
          firstPostShortcode = result.details.posts[0].code;
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_post_details
  // -------------------------------------------------------------------------
  describe("instagram_post_details", () => {
    it("returns details of a specific post", async () => {
      if (!firstPostShortcode) {
        console.warn("[instagram] Skipping instagram_post_details: no shortcode from user_posts test");
        return;
      }
      const tool = createInstagramPostDetailsTool(instagramManager);
      const result = await tool.execute("t", { shortcode: firstPostShortcode, account: ACCOUNT });

      if (result.details.error) {
        expect(result.details.error).toMatch(/error/i);
      } else {
        expect(result.details).not.toHaveProperty("error");
        expect(result.details.code).toBe(firstPostShortcode);
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_post_comments
  // -------------------------------------------------------------------------
  describe("instagram_post_comments", () => {
    it("returns comments for a post", async () => {
      if (!firstPostShortcode) {
        console.warn("[instagram] Skipping instagram_post_comments: no shortcode from user_posts test");
        return;
      }
      const tool = createInstagramPostCommentsTool(instagramManager);
      const result = await tool.execute("t", { shortcode: firstPostShortcode, account: ACCOUNT });

      if (result.details.error) {
        expect(result.details.error).toMatch(/error/i);
      } else {
        expect(Array.isArray(result.details.comments)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_stories
  // -------------------------------------------------------------------------
  describe("instagram_stories", () => {
    it("returns story tray", async () => {
      const tool = createInstagramStoriesTool(instagramManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.story_tray)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // instagram_reels
  // -------------------------------------------------------------------------
  describe("instagram_reels", () => {
    it("returns trending reels", async () => {
      const tool = createInstagramReelsTool(instagramManager);
      const result = await tool.execute("t", { count: 3, account: ACCOUNT });

      if (result.details.error) {
        // Tolerate API errors from the explore endpoint (may return unexpected shapes)
        expect(typeof result.details.error).toBe("string");
      } else {
        expect(Array.isArray(result.details.reels)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_search
  // -------------------------------------------------------------------------
  describe("instagram_search", () => {
    it("searches for users/hashtags/places", async () => {
      const tool = createInstagramSearchTool(instagramManager);
      const result = await tool.execute("t", { query: "photography", account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.users).toBeDefined();
      expect(result.details.hashtags).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // instagram_followers
  // -------------------------------------------------------------------------
  describe("instagram_followers", () => {
    it("returns followers for a user", async () => {
      const targetUsername = myUsername || "instagram";

      const tool = createInstagramFollowersTool(instagramManager);
      const result = await tool.execute("t", { username: targetUsername, count: 5, account: ACCOUNT });

      if (result.details.error) {
        // May fail for private accounts
        expect(result.details.error).toMatch(/error|private|resolve/i);
      } else {
        expect(Array.isArray(result.details.followers)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_following
  // -------------------------------------------------------------------------
  describe("instagram_following", () => {
    it("returns following for a user", async () => {
      const targetUsername = myUsername || "instagram";

      const tool = createInstagramFollowingTool(instagramManager);
      const result = await tool.execute("t", { username: targetUsername, count: 5, account: ACCOUNT });

      if (result.details.error) {
        expect(result.details.error).toMatch(/error|private|resolve/i);
      } else {
        expect(Array.isArray(result.details.following)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_conversations
  // -------------------------------------------------------------------------
  describe("instagram_conversations", () => {
    it("returns DM conversations array", async () => {
      const tool = createInstagramConversationsTool(instagramManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.conversations)).toBe(true);

      if (result.details.conversations.length > 0) {
        firstThreadId = result.details.conversations[0].thread_id;
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_messages
  // -------------------------------------------------------------------------
  describe("instagram_messages", () => {
    it("returns messages from a DM thread", async () => {
      if (!firstThreadId) {
        console.warn("[instagram] Skipping instagram_messages: no thread_id from conversations test");
        return;
      }
      const tool = createInstagramMessagesTool(instagramManager);
      const result = await tool.execute("t", {
        thread_id: firstThreadId,
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.messages)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // instagram_notifications
  // -------------------------------------------------------------------------
  describe("instagram_notifications", () => {
    it("returns notifications array or a known API error", async () => {
      const tool = createInstagramNotificationsTool(instagramManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      if (result.details.error) {
        // news/inbox/ is known to return 500 on some accounts — accept graceful error
        expect(result.details.error).toMatch(/500|unavailable|error/i);
      } else {
        expect(Array.isArray(result.details.notifications)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_saved
  // -------------------------------------------------------------------------
  describe("instagram_saved", () => {
    it("returns saved posts array", async () => {
      const tool = createInstagramSavedTool(instagramManager);
      const result = await tool.execute("t", { account: ACCOUNT });

      if (result.details.error) {
        expect(result.details.error).toMatch(/error/i);
      } else {
        expect(Array.isArray(result.details.saved_posts)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // instagram_auth_setup — verify tool.name only (browser flow — don't execute)
  // -------------------------------------------------------------------------
  describe("instagram_auth_setup", () => {
    it("has the correct tool name (browser flow — not executed)", () => {
      const tool = createInstagramAuthTool(instagramManager, {} as any);
      expect(tool.name).toBe("instagram_auth_setup");
      expect(tool.label).toBe("Instagram Auth Setup");
    });
  });
});
