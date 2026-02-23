/**
 * Integration tests — hit the real Google Slides API.
 * Run with: RUN_WRITE_TESTS=1 CLIENT_SECRET_PATH="..." pnpm vitest run tests/integration/slides.test.ts
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { OAuthClientManager } from "../../src/auth/oauth-client-manager.js";
import { TokenStore } from "../../src/auth/token-store.js";
import { createDriveDeleteTool } from "../../src/tools/drive-delete.js";
import { createSlidesAppendSlideTool } from "../../src/tools/slides-append-slide.js";
import { createSlidesCreateTool } from "../../src/tools/slides-create.js";
import { createSlidesGetTool } from "../../src/tools/slides-get.js";
import { createSlidesReplaceTextTool } from "../../src/tools/slides-replace-text.js";

const CLIENT_SECRET_PATH =
  process.env.CLIENT_SECRET_PATH ??
  "/Users/markshteyn/Downloads/client_secret_772791512967-bb4nvpsu9umlr74nt12cjvloaq6hcale.apps.googleusercontent.com(1).json";

const TOKENS_PATH = process.env.TOKENS_PATH ?? join(homedir(), ".openclaw", "omniclaw-tokens.json");

const ACCOUNT = process.env.GMAIL_ACCOUNT ?? "default";
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

const credentialsExist = existsSync(CLIENT_SECRET_PATH) && existsSync(TOKENS_PATH);

if (!credentialsExist) {
  console.warn("\n[integration] Skipping: credentials not found.\n");
}

let clientManager: OAuthClientManager;
let createdPresentationId: string;

describe.skipIf(!credentialsExist)("Google Slides API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    const tokenStore = new TokenStore(TOKENS_PATH);
    clientManager = new OAuthClientManager(CLIENT_SECRET_PATH, 9753, tokenStore);
  });

  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    it("slides_create — creates a presentation", async () => {
      const tool = createSlidesCreateTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        title: "[omniclaw integration test] slides_create",
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.id).toBe("string");
      expect(result.details.id.length).toBeGreaterThan(0);
      expect(result.details.url).toContain(result.details.id);

      createdPresentationId = result.details.id;
    });

    it("slides_get — reads the created presentation", async () => {
      expect(createdPresentationId).toBeTruthy();

      const tool = createSlidesGetTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        presentation_id: createdPresentationId,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.id).toBe(createdPresentationId);
      expect(result.details.title).toBe("[omniclaw integration test] slides_create");
      expect(typeof result.details.slideCount).toBe("number");
      expect(Array.isArray(result.details.slides)).toBe(true);
    });

    it("slides_append_slide — appends a slide with title and body", async () => {
      expect(createdPresentationId).toBeTruthy();

      const tool = createSlidesAppendSlideTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        presentation_id: createdPresentationId,
        title: "Test Slide Title",
        body: "Hello from omniclaw integration test.",
      });

      expect(result.details.success).toBe(true);
      expect(typeof result.details.slide_id).toBe("string");
    });

    it("slides_get — confirms the new slide is present", async () => {
      expect(createdPresentationId).toBeTruthy();

      const tool = createSlidesGetTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        presentation_id: createdPresentationId,
      });

      const hasTestSlide = result.details.slides.some((s: { texts: string[] }) =>
        s.texts.some((t) => t.includes("Test Slide Title")),
      );
      expect(hasTestSlide).toBe(true);
    });

    it("slides_replace_text — replaces text across slides", async () => {
      expect(createdPresentationId).toBeTruthy();

      const tool = createSlidesReplaceTextTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        presentation_id: createdPresentationId,
        find: "omniclaw",
        replace: "OMNICLAW",
        match_case: true,
      });

      expect(result.details.success).toBe(true);
      expect(result.details.occurrences_replaced).toBeGreaterThan(0);
    });

    it("drive_delete — permanently deletes the test presentation", async () => {
      expect(createdPresentationId).toBeTruthy();

      const tool = createDriveDeleteTool(clientManager);
      const result = await tool.execute("t", {
        account: ACCOUNT,
        file_id: createdPresentationId,
        permanent: true,
      });

      expect(result.details.success).toBe(true);
    });
  });
});
