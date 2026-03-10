/**
 * Integration tests — hit the real Gemini API.
 *
 * Required env vars:
 *   GEMINI_API_KEY       Gemini API key from Google AI Studio
 *
 * Video tests are skipped unless:
 *   RUN_VIDEO_TESTS=1    enable Veo video generation (slow, costs money)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, statSync, rmSync, mkdirSync } from "fs";
import * as path from "path";
import * as os from "os";
import { ApiKeyStore } from "../../src/auth/api-key-store.js";
import { GeminiClientManager } from "../../src/auth/gemini-client-manager.js";
import { createGeminiAuthSetupTool } from "../../src/tools/gemini-auth.js";
import {
  createGeminiImagenTool,
} from "../../src/tools/gemini-generate-image.js";
import { createGeminiGenerateVideoTool } from "../../src/tools/gemini-generate-video.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const RUN_VIDEO_TESTS = process.env.RUN_VIDEO_TESTS === "1";

const hasKey = GEMINI_API_KEY.length > 0;

if (!hasKey) {
  console.warn(
    "\n[integration] Skipping Gemini tests: GEMINI_API_KEY not set.\n",
  );
}

// Temp directory for generated files
const SAVE_DIR = path.join(os.tmpdir(), `gemini-integration-test-${Date.now()}`);
const STORE_PATH = path.join(os.tmpdir(), `gemini-test-keys-${Date.now()}.json`);

// ---------------------------------------------------------------------------
let manager: GeminiClientManager;

describe.skipIf(!hasKey)("Gemini API integration", { timeout: 120_000 }, () => {
  beforeAll(() => {
    const store = new ApiKeyStore(STORE_PATH);
    store.set("default", GEMINI_API_KEY);
    manager = new GeminiClientManager(store);
    mkdirSync(SAVE_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(SAVE_DIR)) {
      rmSync(SAVE_DIR, { recursive: true, force: true });
    }
    try { rmSync(STORE_PATH); } catch { /* ignore */ }
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  describe("gemini_auth_setup", () => {
    it("validates the API key", async () => {
      const tool = createGeminiAuthSetupTool(manager);
      const result = await tool.execute("t", { api_key: GEMINI_API_KEY });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.status).toBe("authenticated");
    });

    it("rejects an invalid API key", async () => {
      const badStore = new ApiKeyStore(path.join(os.tmpdir(), `gemini-bad-${Date.now()}.json`));
      const badManager = new GeminiClientManager(badStore);
      const tool = createGeminiAuthSetupTool(badManager);
      const result = await tool.execute("t", { api_key: "invalid-key-12345" });

      expect(result.details).toHaveProperty("error", "auth_failed");
    });
  });

  // -------------------------------------------------------------------------
  // Imagen
  // -------------------------------------------------------------------------
  describe("gemini_imagen", () => {
    it("generates an image with Imagen and saves to disk", async () => {
      const tool = createGeminiImagenTool(manager);
      const result = await tool.execute("t", {
        prompt: "A simple blue square on a white background",
        save_dir: SAVE_DIR,
        number_of_images: 1,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.images).toBeDefined();
      expect(result.details.images.length).toBe(1);

      const image = result.details.images[0];
      expect(existsSync(image.path)).toBe(true);
      expect(statSync(image.path).size).toBeGreaterThan(0);
      expect(image.mime_type).toBe("image/png");
    });

    it("generates multiple images", async () => {
      const tool = createGeminiImagenTool(manager);
      const result = await tool.execute("t", {
        prompt: "A green triangle on a white background",
        save_dir: SAVE_DIR,
        number_of_images: 2,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.count).toBe(2);
      expect(result.details.images.length).toBe(2);

      for (const image of result.details.images) {
        expect(existsSync(image.path)).toBe(true);
        expect(statSync(image.path).size).toBeGreaterThan(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Video — opt-in (slow + costs money)
  // -------------------------------------------------------------------------
  describe.skipIf(!RUN_VIDEO_TESTS)(
    "gemini_generate_video (RUN_VIDEO_TESTS=1)",
    { timeout: 600_000 },
    () => {
      it("generates a video and saves to disk", async () => {
        const tool = createGeminiGenerateVideoTool(manager);
        const result = await tool.execute("t", {
          prompt: "A slow pan across a calm lake at sunrise",
          save_dir: SAVE_DIR,
          duration_seconds: 4,
          timeout_seconds: 300,
        });

        expect(result.details).not.toHaveProperty("error");
        expect(result.details.videos).toBeDefined();
        expect(result.details.videos.length).toBeGreaterThan(0);

        const video = result.details.videos[0];
        expect(existsSync(video.path)).toBe(true);
        expect(statSync(video.path).size).toBeGreaterThan(0);
        expect(video.mime_type).toBe("video/mp4");
      });
    },
  );
});
