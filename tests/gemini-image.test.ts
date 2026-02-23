import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGeminiGenerateImageTool,
  createGeminiEditImageTool,
} from "../src/tools/gemini-image.js";

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-image-data")),
  };
});

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
  generateImages: vi.fn(),
}));

function makeManager(hasKey = true) {
  return {
    hasKey: vi.fn().mockReturnValue(hasKey),
    getClient: vi.fn().mockReturnValue({
      models: {
        generateContent: mocks.generateContent,
        generateImages: mocks.generateImages,
      },
    }),
  };
}

describe("createGeminiGenerateImageTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when no key stored", async () => {
    const tool = createGeminiGenerateImageTool(makeManager(false) as any);
    const result = await tool.execute("c", { prompt: "a cat", save_directory: "/tmp" });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("routes to generateContent for gemini models", async () => {
    const tool = createGeminiGenerateImageTool(makeManager() as any);

    mocks.generateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: { mimeType: "image/png", data: Buffer.from("img").toString("base64") },
              },
              { text: "Here is your image" },
            ],
          },
        },
      ],
    });

    const result = await tool.execute("c", {
      prompt: "a cat",
      save_directory: "/tmp/images",
      model: "gemini-2.5-flash-preview-image-generation",
    });

    expect(mocks.generateContent).toHaveBeenCalled();
    expect(mocks.generateImages).not.toHaveBeenCalled();
    expect(result.details.images).toHaveLength(1);
    expect(result.details.images[0].mimeType).toBe("image/png");
    expect(result.details.text).toBe("Here is your image");
  });

  it("routes to generateImages for imagen models", async () => {
    const tool = createGeminiGenerateImageTool(makeManager() as any);

    mocks.generateImages.mockResolvedValue({
      generatedImages: [
        { image: { imageBytes: Buffer.from("img1").toString("base64"), mimeType: "image/png" } },
        { image: { imageBytes: Buffer.from("img2").toString("base64"), mimeType: "image/png" } },
      ],
    });

    const result = await tool.execute("c", {
      prompt: "a cat",
      save_directory: "/tmp/images",
      model: "imagen-4",
      number_of_images: 2,
    });

    expect(mocks.generateImages).toHaveBeenCalled();
    expect(mocks.generateContent).not.toHaveBeenCalled();
    expect(result.details.images).toHaveLength(2);
  });

  it("passes aspect_ratio to imagen models", async () => {
    const tool = createGeminiGenerateImageTool(makeManager() as any);

    mocks.generateImages.mockResolvedValue({ generatedImages: [] });

    await tool.execute("c", {
      prompt: "landscape",
      save_directory: "/tmp",
      model: "imagen-4-fast",
      aspect_ratio: "16:9",
    });

    expect(mocks.generateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ aspectRatio: "16:9" }),
      }),
    );
  });

  it("handles generation errors gracefully", async () => {
    const tool = createGeminiGenerateImageTool(makeManager() as any);

    mocks.generateContent.mockRejectedValue(new Error("Rate limit exceeded"));

    const result = await tool.execute("c", {
      prompt: "a cat",
      save_directory: "/tmp",
    });

    expect(result.details).toMatchObject({
      error: "generation_failed",
      message: "Rate limit exceeded",
    });
  });
});

describe("createGeminiEditImageTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns auth_required when no key stored", async () => {
    const tool = createGeminiEditImageTool(makeManager(false) as any);
    const result = await tool.execute("c", {
      prompt: "make it blue",
      input_image_path: "/tmp/img.png",
      save_directory: "/tmp",
    });
    expect(result.details).toMatchObject({ error: "auth_required" });
  });

  it("reads input file and includes in request", async () => {
    const tool = createGeminiEditImageTool(makeManager() as any);
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockReturnValue(true);

    mocks.generateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: Buffer.from("edited").toString("base64"),
                },
              },
            ],
          },
        },
      ],
    });

    const result = await tool.execute("c", {
      prompt: "make it blue",
      input_image_path: "/tmp/input.png",
      save_directory: "/tmp/output",
    });

    expect(mocks.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({ text: "make it blue" }),
              expect.objectContaining({
                inlineData: expect.objectContaining({ mimeType: "image/png" }),
              }),
            ]),
          }),
        ],
      }),
    );
    expect(result.details.images).toHaveLength(1);
  });

  it("returns error for missing input file", async () => {
    const tool = createGeminiEditImageTool(makeManager() as any);
    const { existsSync } = await import("fs");
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p === "string" && p.includes("nonexistent")) return false;
      return true;
    });

    const result = await tool.execute("c", {
      prompt: "edit it",
      input_image_path: "/tmp/nonexistent.png",
      save_directory: "/tmp",
    });

    expect(result.details).toMatchObject({ error: "file_not_found" });
  });
});
