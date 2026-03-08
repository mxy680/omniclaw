/**
 * Integration tests — hit the real Wolfram Alpha API.
 *
 * Required env vars (or fall back to detected defaults):
 *   WOLFRAM_APPID        Wolfram Alpha AppID
 *
 * These tests are read-only (Wolfram Alpha has no write operations).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { WolframClient } from "../../src/auth/wolfram-client.js";
import { createWolframQueryTool, createWolframQueryFullTool } from "../../src/tools/wolfram-query.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WOLFRAM_APPID = process.env.WOLFRAM_APPID ?? "";
const hasAppId = WOLFRAM_APPID.length > 0;

if (!hasAppId) {
  console.warn(
    "\n[integration] Skipping Wolfram Alpha tests: WOLFRAM_APPID not set.\n",
  );
}

// ---------------------------------------------------------------------------
let wolfram: WolframClient;

describe.skipIf(!hasAppId)("Wolfram Alpha API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    wolfram = new WolframClient(WOLFRAM_APPID);
  });

  // -------------------------------------------------------------------------
  // LLM API — wolfram_query
  // -------------------------------------------------------------------------
  describe("wolfram_query (LLM API)", () => {
    it("answers a simple math query", async () => {
      const tool = createWolframQueryTool(wolfram);
      const result = await tool.execute("t", { input: "2 + 2" });
      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.result).toBe("string");
      expect(result.details.result).toContain("4");
    });

    it("answers a unit conversion query", async () => {
      const tool = createWolframQueryTool(wolfram);
      const result = await tool.execute("t", {
        input: "convert 100 fahrenheit to celsius",
      });
      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.result).toBe("string");
      expect(result.details.result.length).toBeGreaterThan(0);
    });

    it("respects maxchars parameter", async () => {
      const tool = createWolframQueryTool(wolfram);
      const result = await tool.execute("t", {
        input: "population of the United States",
        maxchars: 500,
      });
      expect(result.details).not.toHaveProperty("error");
      expect(typeof result.details.result).toBe("string");
    });

    it("returns error for unauthenticated client", async () => {
      const unauthClient = new WolframClient();
      const tool = createWolframQueryTool(unauthClient);
      const result = await tool.execute("t", { input: "2+2" });
      expect(result.details).toHaveProperty("error", "auth_required");
    });
  });

  // -------------------------------------------------------------------------
  // Full Results API — wolfram_query_full
  // -------------------------------------------------------------------------
  describe("wolfram_query_full (Full Results API)", () => {
    it("returns structured JSON with pods", async () => {
      const tool = createWolframQueryFullTool(wolfram);
      const result = await tool.execute("t", { input: "integrate x^2 dx" });
      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("queryresult");
      expect(result.details.queryresult).toHaveProperty("pods");
      expect(Array.isArray(result.details.queryresult.pods)).toBe(true);
      expect(result.details.queryresult.pods.length).toBeGreaterThan(0);
    });

    it("filters by format parameter", async () => {
      const tool = createWolframQueryFullTool(wolfram);
      const result = await tool.execute("t", {
        input: "5! (factorial)",
        format: "plaintext",
      });
      expect(result.details).not.toHaveProperty("error");
      expect(result.details.queryresult.success).toBe(true);
    });

    it("returns error for unauthenticated client", async () => {
      const unauthClient = new WolframClient();
      const tool = createWolframQueryFullTool(unauthClient);
      const result = await tool.execute("t", { input: "2+2" });
      expect(result.details).toHaveProperty("error", "auth_required");
    });
  });
});
