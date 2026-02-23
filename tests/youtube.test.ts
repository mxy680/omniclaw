import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseVideoId } from "../src/tools/youtube-utils";
import { createYouTubeSearchTool, createYouTubeVideoDetailsTool } from "../src/tools/youtube-search";
import { createYouTubeTranscriptTool } from "../src/tools/youtube-transcript";
import { createYouTubeChannelInfoTool, createYouTubeVideoCommentsTool } from "../src/tools/youtube-social";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  searchList: vi.fn(),
  videosList: vi.fn(),
  channelsList: vi.fn(),
  commentThreadsList: vi.fn(),
  fetchTranscript: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    youtube: () => ({
      search: { list: mocks.searchList },
      videos: { list: mocks.videosList },
      channels: { list: mocks.channelsList },
      commentThreads: { list: mocks.commentThreadsList },
    }),
  },
}));

vi.mock("youtube-transcript", () => ({
  YoutubeTranscript: {
    fetchTranscript: mocks.fetchTranscript,
  },
}));

function makeManager(hasAccount = true) {
  return {
    listAccounts: vi.fn().mockReturnValue(hasAccount ? ["default"] : []),
    getClient: vi.fn().mockReturnValue({}),
  };
}

// ── parseVideoId ────────────────────────────────────────────────────────────

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

// ── youtube_search ──────────────────────────────────────────────────────────

describe("createYouTubeSearchTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when not authenticated", async () => {
    const tool = createYouTubeSearchTool(makeManager(false) as any);
    const result = await tool.execute("c", { query: "typescript" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("returns search results", async () => {
    mocks.searchList.mockResolvedValue({
      data: {
        items: [
          {
            id: { videoId: "abc123def45" },
            snippet: {
              title: "Learn TS",
              channelTitle: "CodeChan",
              channelId: "UC123",
              description: "A great video",
              publishedAt: "2025-01-01T00:00:00Z",
              thumbnails: { high: { url: "https://img.youtube.com/vi/abc123def45/hqdefault.jpg" } },
            },
          },
        ],
      },
    });

    const tool = createYouTubeSearchTool(makeManager() as any);
    const result = await tool.execute("c", { query: "typescript" });

    expect(result.details.results).toHaveLength(1);
    expect(result.details.results[0].videoId).toBe("abc123def45");
    expect(result.details.results[0].title).toBe("Learn TS");
  });

  it("handles API errors gracefully", async () => {
    mocks.searchList.mockRejectedValue(new Error("Quota exceeded"));
    const tool = createYouTubeSearchTool(makeManager() as any);
    const result = await tool.execute("c", { query: "test" });
    expect(result.details).toMatchObject({ error: "search_failed", message: "Quota exceeded" });
  });
});

// ── youtube_video_details ───────────────────────────────────────────────────

describe("createYouTubeVideoDetailsTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when not authenticated", async () => {
    const tool = createYouTubeVideoDetailsTool(makeManager(false) as any);
    const result = await tool.execute("c", { video: "dQw4w9WgXcQ" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("returns invalid_video for bad input", async () => {
    const tool = createYouTubeVideoDetailsTool(makeManager() as any);
    const result = await tool.execute("c", { video: "not-valid" });
    expect(result.details).toMatchObject({ error: "invalid_video" });
  });

  it("returns video details", async () => {
    mocks.videosList.mockResolvedValue({
      data: {
        items: [
          {
            snippet: {
              title: "Never Gonna Give You Up",
              description: "The classic.",
              channelTitle: "Rick Astley",
              channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
              publishedAt: "2009-10-25T06:57:33Z",
              tags: ["rick", "astley"],
              categoryId: "10",
              thumbnails: { high: { url: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" } },
            },
            contentDetails: { duration: "PT3M33S" },
            statistics: { viewCount: "1500000000", likeCount: "15000000", commentCount: "3000000" },
          },
        ],
      },
    });

    const tool = createYouTubeVideoDetailsTool(makeManager() as any);
    const result = await tool.execute("c", { video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });

    expect(result.details.videoId).toBe("dQw4w9WgXcQ");
    expect(result.details.title).toBe("Never Gonna Give You Up");
    expect(result.details.duration).toBe("PT3M33S");
    expect(result.details.viewCount).toBe("1500000000");
  });

  it("returns not_found when video does not exist", async () => {
    mocks.videosList.mockResolvedValue({ data: { items: [] } });
    const tool = createYouTubeVideoDetailsTool(makeManager() as any);
    const result = await tool.execute("c", { video: "dQw4w9WgXcQ" });
    expect(result.details).toMatchObject({ error: "not_found" });
  });
});

// ── youtube_get_transcript ──────────────────────────────────────────────────

describe("createYouTubeTranscriptTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns invalid_video for bad input", async () => {
    const tool = createYouTubeTranscriptTool();
    const result = await tool.execute("c", { video: "not-valid" });
    expect(result.details).toMatchObject({ error: "invalid_video" });
  });

  it("returns transcript segments and full text", async () => {
    mocks.fetchTranscript.mockResolvedValue([
      { text: "Hello world", offset: 0, duration: 2000 },
      { text: "Goodbye world", offset: 2000, duration: 1500 },
    ]);

    const tool = createYouTubeTranscriptTool();
    const result = await tool.execute("c", { video: "dQw4w9WgXcQ" });

    expect(result.details.videoId).toBe("dQw4w9WgXcQ");
    expect(result.details.segmentCount).toBe(2);
    expect(result.details.fullText).toBe("Hello world Goodbye world");
    expect(result.details.segments).toHaveLength(2);
  });

  it("handles transcript errors gracefully", async () => {
    mocks.fetchTranscript.mockRejectedValue(new Error("Transcript is disabled"));
    const tool = createYouTubeTranscriptTool();
    const result = await tool.execute("c", { video: "dQw4w9WgXcQ" });
    expect(result.details).toMatchObject({ error: "transcript_failed", message: "Transcript is disabled" });
  });
});

// ── youtube_channel_info ────────────────────────────────────────────────────

describe("createYouTubeChannelInfoTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when not authenticated", async () => {
    const tool = createYouTubeChannelInfoTool(makeManager(false) as any);
    const result = await tool.execute("c", { channel: "@mkbhd" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("returns channel info for a handle", async () => {
    mocks.channelsList.mockResolvedValue({
      data: {
        items: [
          {
            id: "UCBJycsmduvYEL83R_U4JriQ",
            snippet: {
              title: "MKBHD",
              description: "Tech reviews.",
              customUrl: "@mkbhd",
              publishedAt: "2008-03-21T00:00:00Z",
              country: "US",
              thumbnails: { high: { url: "https://example.com/thumb.jpg" } },
            },
            statistics: { subscriberCount: "19000000", videoCount: "1500", viewCount: "4000000000" },
          },
        ],
      },
    });

    const tool = createYouTubeChannelInfoTool(makeManager() as any);
    const result = await tool.execute("c", { channel: "@mkbhd" });

    expect(result.details.title).toBe("MKBHD");
    expect(result.details.subscriberCount).toBe("19000000");
    expect(mocks.channelsList).toHaveBeenCalledWith(
      expect.objectContaining({ forHandle: "@mkbhd" })
    );
  });

  it("uses channel ID when starts with UC", async () => {
    mocks.channelsList.mockResolvedValue({ data: { items: [{ id: "UCtest", snippet: { title: "Test" }, statistics: {} }] } });
    const tool = createYouTubeChannelInfoTool(makeManager() as any);
    await tool.execute("c", { channel: "UCtest123456789" });
    expect(mocks.channelsList).toHaveBeenCalledWith(
      expect.objectContaining({ id: ["UCtest123456789"] })
    );
  });

  it("returns not_found for unknown channel", async () => {
    mocks.channelsList.mockResolvedValue({ data: { items: [] } });
    const tool = createYouTubeChannelInfoTool(makeManager() as any);
    const result = await tool.execute("c", { channel: "@nonexistent" });
    expect(result.details).toMatchObject({ error: "not_found" });
  });
});

// ── youtube_video_comments ──────────────────────────────────────────────────

describe("createYouTubeVideoCommentsTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when not authenticated", async () => {
    const tool = createYouTubeVideoCommentsTool(makeManager(false) as any);
    const result = await tool.execute("c", { video: "dQw4w9WgXcQ" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("returns invalid_video for bad input", async () => {
    const tool = createYouTubeVideoCommentsTool(makeManager() as any);
    const result = await tool.execute("c", { video: "not-valid" });
    expect(result.details).toMatchObject({ error: "invalid_video" });
  });

  it("returns comments for a video", async () => {
    mocks.commentThreadsList.mockResolvedValue({
      data: {
        items: [
          {
            snippet: {
              topLevelComment: {
                snippet: {
                  authorDisplayName: "Alice",
                  authorChannelId: { value: "UCabc" },
                  textDisplay: "Great video!",
                  likeCount: 42,
                  publishedAt: "2025-01-01T00:00:00Z",
                  updatedAt: "2025-01-01T00:00:00Z",
                },
              },
              totalReplyCount: 3,
            },
          },
        ],
      },
    });

    const tool = createYouTubeVideoCommentsTool(makeManager() as any);
    const result = await tool.execute("c", { video: "dQw4w9WgXcQ" });

    expect(result.details.comments).toHaveLength(1);
    expect(result.details.comments[0].author).toBe("Alice");
    expect(result.details.comments[0].likeCount).toBe(42);
    expect(result.details.comments[0].totalReplyCount).toBe(3);
  });

  it("handles comments disabled", async () => {
    mocks.commentThreadsList.mockRejectedValue(new Error("commentsDisabled"));
    const tool = createYouTubeVideoCommentsTool(makeManager() as any);
    const result = await tool.execute("c", { video: "dQw4w9WgXcQ" });
    expect(result.details).toMatchObject({ error: "comments_disabled" });
  });
});
