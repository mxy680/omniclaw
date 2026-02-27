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
let tiktokManager: TikTokClientManager;

// ---------------------------------------------------------------------------
describe.skipIf(!authCredentialsAvailable)("TikTok API integration", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    tiktokManager = new TikTokClientManager(TOKENS_PATH);

    if (!tiktokManager.hasCredentials(ACCOUNT)) {
      const authTool = createTikTokAuthTool(tiktokManager, {
        ...oclConfig,
        tiktok_username: TIKTOK_USERNAME,
        tiktok_password: TIKTOK_PASSWORD,
      });
      const result = await authTool.execute("reauth", {});
      const data = JSON.parse(result.content[0].text);
      expect(data.status).toMatch(/authenticated|already_authenticated/);
    }
  }, 120_000);

  it("tiktok_profile — gets own profile", async () => {
    const tool = createTikTokProfileTool(tiktokManager);
    const result = await tool.execute("test", {});
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.uniqueId).toBeTruthy();
  });

  it("tiktok_get_user — gets a public user", async () => {
    const tool = createTikTokGetUserTool(tiktokManager);
    const result = await tool.execute("test", { username: "tiktok" });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.uniqueId).toBeTruthy();
  });

  it("tiktok_user_videos — gets user videos", async () => {
    const tool = createTikTokUserVideosTool(tiktokManager);
    const result = await tool.execute("test", { username: "tiktok", count: 3 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.videos).toBeDefined();
  });

  it("tiktok_feed — gets For You page", async () => {
    const tool = createTikTokFeedTool(tiktokManager);
    const result = await tool.execute("test", { count: 5 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.videos).toBeDefined();
  });

  it("tiktok_search_videos — searches videos", async () => {
    const tool = createTikTokSearchVideosTool(tiktokManager);
    const result = await tool.execute("test", { query: "cooking", count: 5 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.videos).toBeDefined();
  });

  it("tiktok_search_users — searches users", async () => {
    const tool = createTikTokSearchUsersTool(tiktokManager);
    const result = await tool.execute("test", { query: "cooking", count: 5 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.users).toBeDefined();
  });

  it("tiktok_trending — gets trending videos", async () => {
    const tool = createTikTokTrendingTool(tiktokManager);
    const result = await tool.execute("test", { count: 5 });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeUndefined();
    expect(data.videos).toBeDefined();
  });

  it("tiktok_video_comments — gets comments on a video", async () => {
    const trendingTool = createTikTokTrendingTool(tiktokManager);
    const trendingResult = await trendingTool.execute("test", { count: 1 });
    const trendingData = JSON.parse(trendingResult.content[0].text);

    if (trendingData.videos?.length > 0) {
      const videoId = trendingData.videos[0].id;
      const commentsTool = createTikTokVideoCommentsTool(tiktokManager);
      const result = await commentsTool.execute("test", { video: videoId, count: 5 });
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBeUndefined();
      expect(data.comments).toBeDefined();
    }
  });

  it("tiktok_video_details — gets video details", async () => {
    const trendingTool = createTikTokTrendingTool(tiktokManager);
    const trendingResult = await trendingTool.execute("test", { count: 1 });
    const trendingData = JSON.parse(trendingResult.content[0].text);

    if (trendingData.videos?.length > 0) {
      const videoId = trendingData.videos[0].id;
      const detailsTool = createTikTokVideoDetailsTool(tiktokManager);
      const result = await detailsTool.execute("test", { video: videoId });
      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBeUndefined();
      expect(data.id).toBeTruthy();
    }
  });
});
