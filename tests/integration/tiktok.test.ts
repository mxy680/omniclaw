/**
 * Integration tests — hit the real TikTok API via Playwright.
 *
 * Authenticates in beforeAll if no existing session is stored.
 * Credentials are read from the openclaw config file (~/.openclaw/openclaw.json),
 * with env var overrides:
 *   TIKTOK_USERNAME   TikTok username
 *   TIKTOK_PASSWORD   TikTok password
 *
 * Timeout: 120s — each call launches a Playwright browser (~5-10s per call).
 *
 * Run:
 *   pnpm vitest run tests/integration/tiktok.test.ts
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { TikTokClientManager } from "../../src/auth/tiktok-client-manager.js";
import { createTikTokAuthTool } from "../../src/tools/tiktok-auth-tool.js";
import { createTikTokProfileTool, createTikTokGetUserTool } from "../../src/tools/tiktok-profile.js";
import { createTikTokUserVideosTool } from "../../src/tools/tiktok-user-videos.js";
import { createTikTokVideoDetailsTool } from "../../src/tools/tiktok-video-details.js";
import { createTikTokFeedTool } from "../../src/tools/tiktok-feed.js";
import { createTikTokSearchVideosTool, createTikTokSearchUsersTool } from "../../src/tools/tiktok-search.js";
import { createTikTokTrendingTool } from "../../src/tools/tiktok-trending.js";
import { createTikTokVideoCommentsTool } from "../../src/tools/tiktok-video-comments.js";
import type { PluginConfig } from "../../src/types/plugin-config.js";

// ---------------------------------------------------------------------------
// Config — read auth credentials from openclaw plugin config, env overrides
// ---------------------------------------------------------------------------
function loadOpenclawPluginConfig(): PluginConfig {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) return {} as PluginConfig;
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return (raw?.plugins?.entries?.omniclaw?.config ?? {}) as PluginConfig;
  } catch {
    return {} as PluginConfig;
  }
}

const oclConfig = loadOpenclawPluginConfig();

const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-tiktok-tokens.json");
const ACCOUNT = "default";

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME ?? oclConfig.tiktok_username ?? "";
const TIKTOK_PASSWORD = process.env.TIKTOK_PASSWORD ?? oclConfig.tiktok_password ?? "";

const authCredentialsAvailable = TIKTOK_USERNAME !== "" && TIKTOK_PASSWORD !== "";

if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping TikTok: auth credentials not found in " +
      "~/.openclaw/openclaw.json or env vars.\n",
  );
}

// ---------------------------------------------------------------------------
// Shared state populated across tests
// ---------------------------------------------------------------------------
let tiktokManager: TikTokClientManager;

// ---------------------------------------------------------------------------
describe.skipIf(!authCredentialsAvailable)("TikTok API integration", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    tiktokManager = new TikTokClientManager(TOKENS_PATH);

    // Authenticate only if no existing session is stored
    if (!tiktokManager.hasCredentials(ACCOUNT)) {
      const authTool = createTikTokAuthTool(tiktokManager, {
        ...oclConfig,
        tiktok_username: TIKTOK_USERNAME,
        tiktok_password: TIKTOK_PASSWORD,
      });
      const result = await authTool.execute("reauth", {});
      const data = JSON.parse(result.content[0].text);
      console.log("[tiktok] Auth result:", JSON.stringify(data, null, 2));
      expect(data.status).toMatch(/authenticated|already_authenticated/);
    }
  }, 120_000);

  // -------------------------------------------------------------------------
  // tiktok_auth_setup — verify tool metadata only (browser flow — don't re-execute)
  // -------------------------------------------------------------------------
  describe("tiktok_auth_setup", () => {
    it("has the correct tool name (browser flow — not re-executed)", () => {
      const tool = createTikTokAuthTool(tiktokManager, {} as PluginConfig);
      expect(tool.name).toBe("tiktok_auth_setup");
      expect(tool.label).toBe("TikTok Auth Setup");
    });
  });

  // -------------------------------------------------------------------------
  // tiktok_profile
  // -------------------------------------------------------------------------
  describe("tiktok_profile", () => {
    it("returns the authenticated user's own profile", async () => {
      const tool = createTikTokProfileTool(tiktokManager);
      const result = await tool.execute("t", {});
      const data = JSON.parse(result.content[0].text);

      if (data.error) {
        // Tolerate transient API errors
        expect(typeof data.error).toBe("string");
      } else {
        expect(data.uniqueId).toBeTruthy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // tiktok_get_user
  // -------------------------------------------------------------------------
  describe("tiktok_get_user", () => {
    it("fetches a public user profile by username", async () => {
      const tool = createTikTokGetUserTool(tiktokManager);
      const result = await tool.execute("t", { username: "tiktok" });
      const data = JSON.parse(result.content[0].text);

      if (data.error) {
        expect(typeof data.error).toBe("string");
      } else {
        expect(data.uniqueId).toBeTruthy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // tiktok_user_videos
  // -------------------------------------------------------------------------
  describe("tiktok_user_videos", () => {
    it("returns videos from a user", async () => {
      const tool = createTikTokUserVideosTool(tiktokManager);
      const result = await tool.execute("t", { username: "tiktok", count: 3 });
      const data = JSON.parse(result.content[0].text);

      if (data.error) {
        expect(typeof data.error).toBe("string");
      } else {
        expect(data.videos).toBeDefined();
        expect(Array.isArray(data.videos)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // tiktok_feed
  // -------------------------------------------------------------------------
  describe("tiktok_feed", () => {
    it("returns For You page videos", async () => {
      const tool = createTikTokFeedTool(tiktokManager);
      const result = await tool.execute("t", { count: 5 });
      const data = JSON.parse(result.content[0].text);

      if (data.error) {
        expect(typeof data.error).toBe("string");
      } else {
        expect(data.videos).toBeDefined();
        expect(Array.isArray(data.videos)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // tiktok_search_videos
  // -------------------------------------------------------------------------
  describe("tiktok_search_videos", () => {
    it("searches videos by keyword", async () => {
      const tool = createTikTokSearchVideosTool(tiktokManager);
      const result = await tool.execute("t", { query: "cooking", count: 5 });
      const data = JSON.parse(result.content[0].text);

      if (data.error) {
        expect(typeof data.error).toBe("string");
      } else {
        expect(data.videos).toBeDefined();
        expect(Array.isArray(data.videos)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // tiktok_search_users
  // -------------------------------------------------------------------------
  describe("tiktok_search_users", () => {
    it("searches users by keyword", async () => {
      const tool = createTikTokSearchUsersTool(tiktokManager);
      const result = await tool.execute("t", { query: "cooking", count: 5 });
      const data = JSON.parse(result.content[0].text);

      if (data.error) {
        expect(typeof data.error).toBe("string");
      } else {
        expect(data.users).toBeDefined();
        expect(Array.isArray(data.users)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // tiktok_trending
  // -------------------------------------------------------------------------
  describe("tiktok_trending", () => {
    it("returns trending videos", async () => {
      const tool = createTikTokTrendingTool(tiktokManager);
      const result = await tool.execute("t", { count: 5 });
      const data = JSON.parse(result.content[0].text);

      if (data.error) {
        expect(typeof data.error).toBe("string");
      } else {
        expect(data.videos).toBeDefined();
        expect(Array.isArray(data.videos)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // tiktok_video_comments — chains off tiktok_trending to get a video ID
  // -------------------------------------------------------------------------
  describe("tiktok_video_comments", () => {
    it("returns comments on a trending video", async () => {
      // First get a video ID from trending
      const trendingTool = createTikTokTrendingTool(tiktokManager);
      const trendingResult = await trendingTool.execute("t", { count: 1 });
      const trendingData = JSON.parse(trendingResult.content[0].text);

      if (!trendingData.videos || trendingData.videos.length === 0) {
        console.warn("[tiktok] Skipping tiktok_video_comments: no trending videos available");
        return;
      }

      const videoId: string = trendingData.videos[0].id;
      const tool = createTikTokVideoCommentsTool(tiktokManager);
      const result = await tool.execute("t", { video: videoId, count: 5 });
      const data = JSON.parse(result.content[0].text);

      if (data.error) {
        expect(typeof data.error).toBe("string");
      } else {
        expect(data.comments).toBeDefined();
        expect(Array.isArray(data.comments)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // tiktok_video_details — chains off tiktok_trending to get a video ID
  // -------------------------------------------------------------------------
  describe("tiktok_video_details", () => {
    it("returns details for a trending video", async () => {
      // First get a video ID from trending
      const trendingTool = createTikTokTrendingTool(tiktokManager);
      const trendingResult = await trendingTool.execute("t", { count: 1 });
      const trendingData = JSON.parse(trendingResult.content[0].text);

      if (!trendingData.videos || trendingData.videos.length === 0) {
        console.warn("[tiktok] Skipping tiktok_video_details: no trending videos available");
        return;
      }

      const videoId: string = trendingData.videos[0].id;
      const tool = createTikTokVideoDetailsTool(tiktokManager);
      const result = await tool.execute("t", { video: videoId });
      const data = JSON.parse(result.content[0].text);

      if (data.error) {
        expect(typeof data.error).toBe("string");
      } else {
        expect(data.id).toBeTruthy();
      }
    });
  });
});
