/**
 * Integration tests — Gemini AI tools.
 *
 * Credentials: GEMINI_API_KEY env var, or keys file at ~/.openclaw/omniclaw-gemini-keys.json.
 * The suite is skipped when no API key is available.
 *
 * Generation tests (image gen, video gen) are gated behind RUN_GEMINI_GENERATION_TESTS=1
 * because they cost API credits and can be slow.
 */

import { existsSync, readdirSync, unlinkSync, rmdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { tmpdir } from "os";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GeminiClientManager } from "../../src/auth/gemini-client-manager.js";
import { createGeminiAuthTool } from "../../src/tools/gemini-auth-tool.js";
import {
  createGeminiGenerateImageTool,
  createGeminiEditImageTool,
} from "../../src/tools/gemini-image.js";
import { createGeminiGenerateVideoTool } from "../../src/tools/gemini-video-gen.js";
import { createGeminiAnalyzeVideoTool } from "../../src/tools/gemini-video-understand.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const KEYS_PATH = join(homedir(), ".openclaw", "omniclaw-gemini-keys.json");
const ACCOUNT = "default";
const RUN_GEMINI_GENERATION_TESTS = process.env.RUN_GEMINI_GENERATION_TESTS === "1";

// Try to find an API key: env var first, then keys file
let apiKey: string | undefined = process.env.GEMINI_API_KEY;
if (!apiKey && existsSync(KEYS_PATH)) {
  try {
    const mgr = new GeminiClientManager(KEYS_PATH);
    apiKey = mgr.getKey(ACCOUNT) ?? undefined;
  } catch {
    // ignore
  }
}

const hasCredentials = !!apiKey;

if (!hasCredentials) {
  console.warn(
    "\n[integration] Skipping Gemini: no API key found.\n" +
      `  Set GEMINI_API_KEY env var or add key to ${KEYS_PATH}\n`,
  );
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let geminiManager: GeminiClientManager;
const SAVE_DIR = join(tmpdir(), `omniclaw-gemini-test-${Date.now()}`);
let generatedImagePath: string;
let generatedVideoPath: string;

// ---------------------------------------------------------------------------
describe.skipIf(!hasCredentials)("Gemini API integration", { timeout: 120_000 }, () => {
  beforeAll(() => {
    geminiManager = new GeminiClientManager(KEYS_PATH);

    // Ensure the manager has the key (may come from env var rather than file)
    if (apiKey && !geminiManager.hasKey(ACCOUNT)) {
      geminiManager.setKey(ACCOUNT, apiKey);
    }
  });

  afterAll(() => {
    // Clean up temp files
    try {
      if (existsSync(SAVE_DIR)) {
        for (const file of readdirSync(SAVE_DIR)) {
          unlinkSync(join(SAVE_DIR, file));
        }
        rmdirSync(SAVE_DIR);
      }
    } catch {
      // best-effort cleanup
    }
  });

  // -------------------------------------------------------------------------
  // gemini_auth_setup
  // -------------------------------------------------------------------------
  describe("gemini_auth_setup", () => {
    it("validates real API key and reports available models", async () => {
      const tool = createGeminiAuthTool(geminiManager, {} as any);
      const result = await tool.execute("t", { api_key: apiKey });

      expect(result.details.status).toBe("authenticated");
      expect(result.details.account).toBe(ACCOUNT);
      expect(typeof result.details.models_available).toBe("number");
      expect(result.details.models_available).toBeGreaterThan(0);
    });

    it("rejects an invalid API key", async () => {
      const tool = createGeminiAuthTool(geminiManager, {} as any);
      const result = await tool.execute("t", {
        api_key: "invalid-key-zzz",
        account: "test-invalid",
      });

      expect(result.details.status).toBe("error");
      expect(typeof result.details.error).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // Generation tests — gated behind RUN_GEMINI_GENERATION_TESTS=1
  // -------------------------------------------------------------------------
  describe.skipIf(!RUN_GEMINI_GENERATION_TESTS)(
    "generation tests (RUN_GEMINI_GENERATION_TESTS=1)",
    { timeout: 300_000 },
    () => {
      // -----------------------------------------------------------------------
      // gemini_generate_image
      // -----------------------------------------------------------------------
      describe("gemini_generate_image", () => {
        it("generates an image from a prompt and saves to disk", async () => {
          const tool = createGeminiGenerateImageTool(geminiManager);
          const result = await tool.execute("t", {
            prompt: "A simple red circle on a white background",
            save_directory: SAVE_DIR,
            account: ACCOUNT,
          });

          expect(result.details).not.toHaveProperty("error");
          expect(Array.isArray(result.details.images)).toBe(true);
          expect(result.details.images.length).toBeGreaterThan(0);

          const image = result.details.images[0];
          expect(existsSync(image.path)).toBe(true);
          expect(typeof image.mimeType).toBe("string");

          generatedImagePath = image.path;
        });
      });

      // -----------------------------------------------------------------------
      // gemini_edit_image
      // -----------------------------------------------------------------------
      describe("gemini_edit_image", () => {
        it.skipIf(!generatedImagePath)("edits the generated image and saves output", async () => {
          const tool = createGeminiEditImageTool(geminiManager);
          const result = await tool.execute("t", {
            prompt: "Change the circle color to blue",
            input_image_path: generatedImagePath,
            save_directory: SAVE_DIR,
            account: ACCOUNT,
          });

          expect(result.details).not.toHaveProperty("error");
          expect(Array.isArray(result.details.images)).toBe(true);
          expect(result.details.images.length).toBeGreaterThan(0);
          expect(existsSync(result.details.images[0].path)).toBe(true);
        });
      });

      // -----------------------------------------------------------------------
      // gemini_generate_video
      // -----------------------------------------------------------------------
      describe("gemini_generate_video", () => {
        it("generates a short video from a prompt", async () => {
          const tool = createGeminiGenerateVideoTool(geminiManager);
          const result = await tool.execute("t", {
            prompt: "A simple animation of a bouncing ball",
            save_directory: SAVE_DIR,
            account: ACCOUNT,
            timeout_seconds: 240,
          });

          expect(result.details).not.toHaveProperty("error");
          expect(result.details.status).toBe("completed");
          expect(Array.isArray(result.details.videos)).toBe(true);

          if (result.details.videos.length > 0) {
            expect(existsSync(result.details.videos[0].path)).toBe(true);
            generatedVideoPath = result.details.videos[0].path;
          }
        });
      });

      // -----------------------------------------------------------------------
      // gemini_analyze_video
      // -----------------------------------------------------------------------
      describe("gemini_analyze_video", () => {
        it.skipIf(!generatedVideoPath)("analyzes the generated video", async () => {
          const tool = createGeminiAnalyzeVideoTool(geminiManager);
          const result = await tool.execute("t", {
            prompt: "Describe what happens in this video",
            video_path: generatedVideoPath,
            account: ACCOUNT,
          });

          expect(result.details).not.toHaveProperty("error");
          expect(typeof result.details.analysis).toBe("string");
          expect(result.details.analysis.length).toBeGreaterThan(0);
        });
      });
    },
  );
});
