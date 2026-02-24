/**
 * Integration tests — YouTube tools.
 *
 * - parseVideoId utility tests: always run (pure logic, no auth needed)
 * - youtube_get_transcript: always runs (no auth needed, uses public videos)
 * - Authenticated suite: requires Google OAuth credentials (same as Gmail).
 *   Skipped when credentials are missing.
 */

import { existsSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OAuthClientManager } from "../../src/auth/oauth-client-manager.js";
import { TokenStore } from "../../src/auth/token-store.js";
import { parseVideoId } from "../../src/tools/youtube-utils.js";
import { createYouTubeTranscriptTool } from "../../src/tools/youtube-transcript.js";
import { createYouTubeDownloadThumbnailTool } from "../../src/tools/youtube-download-thumbnail.js";
import {
  createYouTubeSearchTool,
  createYouTubeVideoDetailsTool,
} from "../../src/tools/youtube-search.js";
import {
  createYouTubeChannelInfoTool,
  createYouTubeVideoCommentsTool,
} from "../../src/tools/youtube-social.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CLIENT_SECRET_PATH =
  process.env.CLIENT_SECRET_PATH ??
  join(homedir(), ".openclaw", "client_secret.json");

const TOKENS_PATH = process.env.TOKENS_PATH ?? join(homedir(), ".openclaw", "omniclaw-tokens.json");

const ACCOUNT = process.env.YOUTUBE_ACCOUNT ?? "default";

const credentialsExist = existsSync(CLIENT_SECRET_PATH) && existsSync(TOKENS_PATH);

if (!credentialsExist) {
  console.warn(
    "\n[integration] YouTube authenticated tests will be skipped: credentials not found.\n" +
      `  CLIENT_SECRET_PATH=${CLIENT_SECRET_PATH}\n` +
      `  TOKENS_PATH=${TOKENS_PATH}\n`,
  );
}

// ---------------------------------------------------------------------------
// parseVideoId — pure logic, always runs
// ---------------------------------------------------------------------------
describe("parseVideoId", () => {
  it("parses a plain 11-char video ID", () => {
    expect(parseVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses youtube.com/watch?v= URL", () => {
    expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be/ short URL", () => {
    expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses /embed/ URL", () => {
    expect(parseVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses /shorts/ URL", () => {
    expect(parseVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses m.youtube.com URL", () => {
    expect(parseVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("handles URL with extra query params", () => {
    expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for empty string", () => {
    expect(parseVideoId("")).toBeNull();
  });

  it("returns null for unrecognized input", () => {
    expect(parseVideoId("not-a-video-id-at-all")).toBeNull();
  });

  it("returns null for non-YouTube URL", () => {
    expect(parseVideoId("https://example.com/watch?v=abc")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// youtube_get_transcript — no auth needed (public videos)
// ---------------------------------------------------------------------------
describe("youtube_get_transcript", { timeout: 30_000 }, () => {
  it("returns transcript for a well-known public video", async () => {
    const tool = createYouTubeTranscriptTool();
    const result = await tool.execute("t", { video: "dQw4w9WgXcQ" });

    expect(result.details).not.toHaveProperty("error");
    expect(result.details.videoId).toBe("dQw4w9WgXcQ");
    expect(typeof result.details.segmentCount).toBe("number");
    expect(typeof result.details.fullText).toBe("string");
    expect(Array.isArray(result.details.segments)).toBe(true);
  });

  it("returns invalid_video for bad input", async () => {
    const tool = createYouTubeTranscriptTool();
    const result = await tool.execute("t", { video: "not-valid" });
    expect(result.details).toMatchObject({ error: "invalid_video" });
  });

  it("returns error for nonexistent video ID", async () => {
    const tool = createYouTubeTranscriptTool();
    const result = await tool.execute("t", { video: "xxxxxxxxxxx" });
    expect(result.details).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// youtube_download_thumbnail — no auth needed (public thumbnails)
// ---------------------------------------------------------------------------
describe("youtube_download_thumbnail", { timeout: 30_000 }, () => {
  const SAVE_DIR = join(tmpdir(), `omniclaw-yt-thumb-test-${Date.now()}`);

  afterAll(() => {
    try {
      if (existsSync(SAVE_DIR)) {
        for (const file of readdirSync(SAVE_DIR)) {
          unlinkSync(join(SAVE_DIR, file));
        }
        rmdirSync(SAVE_DIR);
      }
    } catch { /* best-effort cleanup */ }
  });

  it("downloads a thumbnail for a well-known video", async () => {
    const tool = createYouTubeDownloadThumbnailTool();
    const result = await tool.execute("t", {
      video_id: "dQw4w9WgXcQ",
      save_dir: SAVE_DIR,
      quality: "high",
    });

    expect(result.details).not.toHaveProperty("error");
    expect(typeof result.details.path).toBe("string");
    expect(existsSync(result.details.path)).toBe(true);
    expect(result.details.mimeType).toBe("image/jpeg");
    expect(result.details.video_id).toBe("dQw4w9WgXcQ");
    expect(result.details.size).toBeGreaterThan(0);
  });

  it("defaults to high quality when quality is omitted", async () => {
    const tool = createYouTubeDownloadThumbnailTool();
    const result = await tool.execute("t", {
      video_id: "dQw4w9WgXcQ",
      save_dir: SAVE_DIR,
    });

    expect(result.details).not.toHaveProperty("error");
    expect(existsSync(result.details.path)).toBe(true);
  });

  it("downloads different quality levels", async () => {
    const tool = createYouTubeDownloadThumbnailTool();

    for (const quality of ["default", "medium", "sd"]) {
      const result = await tool.execute("t", {
        video_id: "dQw4w9WgXcQ",
        save_dir: SAVE_DIR,
        quality,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(existsSync(result.details.path)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Authenticated YouTube tests — require Google OAuth
// ---------------------------------------------------------------------------
let clientManager: OAuthClientManager;
let firstVideoId: string;

describe.skipIf(!credentialsExist)("YouTube API integration (authenticated)", { timeout: 30_000 }, () => {
  beforeAll(() => {
    const tokenStore = new TokenStore(TOKENS_PATH);
    clientManager = new OAuthClientManager(CLIENT_SECRET_PATH, 9753, tokenStore);
  });

  // -------------------------------------------------------------------------
  // youtube_search
  // -------------------------------------------------------------------------
  describe("youtube_search", () => {
    it('searches for "TypeScript tutorial" and returns results', async () => {
      const tool = createYouTubeSearchTool(clientManager);
      const result = await tool.execute("t", {
        query: "TypeScript tutorial",
        max_results: 5,
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.results)).toBe(true);
      expect(result.details.results.length).toBeGreaterThan(0);

      const video = result.details.results[0];
      expect(typeof video.videoId).toBe("string");
      expect(typeof video.title).toBe("string");

      firstVideoId = video.videoId;
    });
  });

  // -------------------------------------------------------------------------
  // youtube_video_details
  // -------------------------------------------------------------------------
  describe("youtube_video_details", () => {
    it("gets details for the first search result", async () => {
      expect(firstVideoId).toBeTruthy();

      const tool = createYouTubeVideoDetailsTool(clientManager);
      const result = await tool.execute("t", { video: firstVideoId, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.videoId).toBe(firstVideoId);
      expect(typeof result.details.title).toBe("string");
      expect(typeof result.details.duration).toBe("string");
    });

    it("returns not_found for a nonexistent video", async () => {
      const tool = createYouTubeVideoDetailsTool(clientManager);
      const result = await tool.execute("t", { video: "dQw4w9WgXc0", account: ACCOUNT });
      expect(result.details).toMatchObject({ error: "not_found" });
    });
  });

  // -------------------------------------------------------------------------
  // youtube_channel_info
  // -------------------------------------------------------------------------
  describe("youtube_channel_info", () => {
    it("gets info for @Google", async () => {
      const tool = createYouTubeChannelInfoTool(clientManager);
      const result = await tool.execute("t", { channel: "@Google", account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.title).toBe("string");
    });

    it("returns not_found for a nonexistent handle", async () => {
      const tool = createYouTubeChannelInfoTool(clientManager);
      const result = await tool.execute("t", {
        channel: "@zzz_no_such_channel_omniclaw_xyzxyz",
        account: ACCOUNT,
      });
      expect(result.details).toMatchObject({ error: "not_found" });
    });
  });

  // -------------------------------------------------------------------------
  // youtube_video_comments
  // -------------------------------------------------------------------------
  describe("youtube_video_comments", () => {
    it("gets comments for a popular video", async () => {
      const tool = createYouTubeVideoCommentsTool(clientManager);
      // Use Rick Astley — guaranteed to have comments
      const result = await tool.execute("t", { video: "dQw4w9WgXcQ", account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(Array.isArray(result.details.comments)).toBe(true);
      expect(result.details.comments.length).toBeGreaterThan(0);

      const comment = result.details.comments[0];
      expect(typeof comment.author).toBe("string");
      expect(typeof comment.text).toBe("string");
    });
  });
});
