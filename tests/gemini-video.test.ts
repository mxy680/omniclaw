import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGeminiGenerateVideoTool } from "../src/tools/gemini-video-gen";
import { createGeminiAnalyzeVideoTool } from "../src/tools/gemini-video-understand";

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-video-data")),
    statSync: vi.fn().mockReturnValue({ size: 10 * 1024 * 1024 }),
  };
});

const mocks = vi.hoisted(() => ({
  generateVideos: vi.fn(),
  getVideosOperation: vi.fn(),
  generateContent: vi.fn(),
  filesUpload: vi.fn(),
  filesGet: vi.fn(),
}));

function makeManager(hasKey = true) {
  return {
    hasKey: vi.fn().mockReturnValue(hasKey),
    getClient: vi.fn().mockReturnValue({
      models: {
        generateVideos: mocks.generateVideos,
        generateContent: mocks.generateContent,
      },
      operations: {
        getVideosOperation: mocks.getVideosOperation,
      },
      files: {
        upload: mocks.filesUpload,
        get: mocks.filesGet,
      },
    }),
  };
}

describe("createGeminiGenerateVideoTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when no key stored", async () => {
    const tool = createGeminiGenerateVideoTool(makeManager(false) as any);
    const result = await tool.execute("c", { prompt: "a sunset", save_directory: "/tmp" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("passes params correctly to SDK", async () => {
    const tool = createGeminiGenerateVideoTool(makeManager() as any);

    // Mock fetch for video download
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });
    vi.stubGlobal("fetch", mockFetch);

    mocks.generateVideos.mockResolvedValue({
      done: true,
      name: "op-123",
      response: {
        generatedVideos: [
          { video: { uri: "https://example.com/video.mp4" } },
        ],
      },
    });

    const result = await tool.execute("c", {
      prompt: "a sunset over the ocean",
      save_directory: "/tmp/videos",
      model: "veo-3.1-generate-preview",
      aspect_ratio: "16:9",
      number_of_videos: 1,
    });

    expect(mocks.generateVideos).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "veo-3.1-generate-preview",
        prompt: "a sunset over the ocean",
        config: expect.objectContaining({
          aspectRatio: "16:9",
          numberOfVideos: 1,
        }),
      })
    );
    expect(result.details.status).toBe("completed");
    expect(result.details.videos).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it("polls for completion when not immediately done", async () => {
    vi.useFakeTimers();

    const tool = createGeminiGenerateVideoTool(makeManager() as any);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
    });
    vi.stubGlobal("fetch", mockFetch);

    mocks.generateVideos.mockResolvedValue({
      done: false,
      name: "op-456",
    });

    mocks.getVideosOperation.mockResolvedValue({
      done: true,
      name: "op-456",
      response: {
        generatedVideos: [
          { video: { uri: "https://example.com/video.mp4" } },
        ],
      },
    });

    const resultPromise = tool.execute("c", {
      prompt: "test",
      save_directory: "/tmp",
      timeout_seconds: 10,
    });

    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;

    expect(mocks.getVideosOperation).toHaveBeenCalled();
    expect(result.details.status).toBe("completed");

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns file_not_found for missing input image", async () => {
    const tool = createGeminiGenerateVideoTool(makeManager() as any);
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === "string" && p.includes("nonexistent")) return false;
      return true;
    });

    const result = await tool.execute("c", {
      prompt: "animate this",
      save_directory: "/tmp",
      input_image_path: "/tmp/nonexistent.png",
    });

    expect(result.details).toMatchObject({ error: "file_not_found" });
  });

  it("handles generation errors gracefully", async () => {
    const tool = createGeminiGenerateVideoTool(makeManager() as any);

    mocks.generateVideos.mockRejectedValue(new Error("Quota exceeded"));

    const result = await tool.execute("c", {
      prompt: "test",
      save_directory: "/tmp",
    });

    expect(result.details).toMatchObject({
      error: "generation_failed",
      message: "Quota exceeded",
    });
  });
});

describe("createGeminiAnalyzeVideoTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when no key stored", async () => {
    const tool = createGeminiAnalyzeVideoTool(makeManager(false) as any);
    const result = await tool.execute("c", {
      prompt: "describe this video",
      video_path: "/tmp/video.mp4",
    });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("returns error for missing video file", async () => {
    const tool = createGeminiAnalyzeVideoTool(makeManager() as any);
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await tool.execute("c", {
      prompt: "describe this",
      video_path: "/tmp/missing.mp4",
    });

    expect(result.details).toMatchObject({ error: "file_not_found" });
  });

  it("uploads video and calls generateContent", async () => {
    const tool = createGeminiAnalyzeVideoTool(makeManager() as any);
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);

    mocks.filesUpload.mockResolvedValue({
      name: "files/abc123",
      uri: "https://generativelanguage.googleapis.com/v1/files/abc123",
      mimeType: "video/mp4",
      state: "ACTIVE",
    });

    mocks.generateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [{ text: "This video shows a sunset over the ocean." }],
        },
      }],
    });

    const result = await tool.execute("c", {
      prompt: "describe this video",
      video_path: "/tmp/video.mp4",
    });

    expect(mocks.filesUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        file: "/tmp/video.mp4",
        config: { mimeType: "video/mp4" },
      })
    );
    expect(mocks.generateContent).toHaveBeenCalled();
    expect(result.details.analysis).toBe("This video shows a sunset over the ocean.");
    expect(result.details.model).toBe("gemini-2.5-flash");
  });

  it("waits for file processing to complete", async () => {
    vi.useFakeTimers();

    const tool = createGeminiAnalyzeVideoTool(makeManager() as any);
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);

    mocks.filesUpload.mockResolvedValue({
      name: "files/abc123",
      state: "PROCESSING",
    });

    mocks.filesGet.mockResolvedValue({
      name: "files/abc123",
      uri: "https://generativelanguage.googleapis.com/v1/files/abc123",
      mimeType: "video/mp4",
      state: "ACTIVE",
    });

    mocks.generateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [{ text: "Analysis result" }],
        },
      }],
    });

    const resultPromise = tool.execute("c", {
      prompt: "describe",
      video_path: "/tmp/video.mp4",
    });

    await vi.advanceTimersByTimeAsync(3000);

    const result = await resultPromise;

    expect(mocks.filesGet).toHaveBeenCalledWith({ name: "files/abc123" });
    expect(result.details.analysis).toBe("Analysis result");

    vi.useRealTimers();
  });

  it("handles failed file processing", async () => {
    const tool = createGeminiAnalyzeVideoTool(makeManager() as any);
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);

    mocks.filesUpload.mockResolvedValue({
      name: "files/abc123",
      state: "FAILED",
    });

    const result = await tool.execute("c", {
      prompt: "describe",
      video_path: "/tmp/video.mp4",
    });

    expect(result.details).toMatchObject({ error: "upload_failed" });
  });
});
