/**
 * Integration tests — hit the real Cronometer API.
 *
 * Re-authenticates in beforeAll via cronometer_auth_setup (Playwright browser login).
 * Credentials are read from the openclaw config file (~/.openclaw/openclaw.json),
 * with env var overrides:
 *   CRONOMETER_EMAIL       Cronometer account email
 *   CRONOMETER_PASSWORD    Cronometer account password
 *
 * Optional env vars:
 *   CRONOMETER_ACCOUNT     Token store account name (default: "default")
 *
 * Run:
 *   CRONOMETER_EMAIL="..." CRONOMETER_PASSWORD="..." pnpm vitest run tests/integration/cronometer.test.ts
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { CronometerClientManager } from "../../src/auth/cronometer-client-manager.js";
import { createCronometerAuthTool } from "../../src/tools/cronometer-auth-tool.js";
import { createCronometerDiaryTool } from "../../src/tools/cronometer-diary.js";
import { createCronometerNutritionTool } from "../../src/tools/cronometer-nutrition.js";
import { createCronometerExercisesTool } from "../../src/tools/cronometer-exercises.js";
import { createCronometerBiometricsTool } from "../../src/tools/cronometer-biometrics.js";
import { createCronometerNotesTool } from "../../src/tools/cronometer-notes.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function loadOpenclawPluginConfig(): Record<string, string> {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return raw?.plugins?.entries?.omniclaw?.config ?? {};
  } catch {
    return {};
  }
}

const oclConfig = loadOpenclawPluginConfig();

const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-cronometer-tokens.json");
const ACCOUNT = process.env.CRONOMETER_ACCOUNT ?? "default";

const CRONOMETER_EMAIL = process.env.CRONOMETER_EMAIL || oclConfig.cronometer_email || "";
const CRONOMETER_PASSWORD = process.env.CRONOMETER_PASSWORD || oclConfig.cronometer_password || "";

const authCredentialsAvailable = CRONOMETER_EMAIL !== "" && CRONOMETER_PASSWORD !== "";

if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping Cronometer tests: auth credentials not found in " +
      "~/.openclaw/openclaw.json or env vars.\n",
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResult(result: any): any {
  const text = result?.content?.[0]?.text;
  return text ? JSON.parse(text) : result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe.skipIf(!authCredentialsAvailable)("Cronometer integration", () => {
  let manager: CronometerClientManager;

  beforeAll(async () => {
    manager = new CronometerClientManager(TOKENS_PATH);

    // Authenticate if no existing valid session
    if (!manager.hasCredentials(ACCOUNT)) {
      const authTool = createCronometerAuthTool(manager, {
        client_secret_path: "",
        cronometer_email: CRONOMETER_EMAIL,
        cronometer_password: CRONOMETER_PASSWORD,
      });
      const result = parseResult(await authTool.execute("test", { account: ACCOUNT }));
      expect(result.status).toBe("authenticated");
      console.log("[cronometer] Authenticated as user:", result.user_id);
    } else {
      console.log("[cronometer] Using existing session for account:", ACCOUNT);
    }
  }, 120_000);

  // ---- Diary ----
  it("cronometer_diary — lists food servings", async () => {
    const tool = createCronometerDiaryTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.servings).toBeDefined();
    expect(Array.isArray(result.servings)).toBe(true);
    console.log(`[cronometer] Diary: ${result.count} servings in last 7 days`);
  }, 30_000);

  // ---- Nutrition Summary ----
  it("cronometer_nutrition_summary — daily totals", async () => {
    const tool = createCronometerNutritionTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.summaries).toBeDefined();
    expect(Array.isArray(result.summaries)).toBe(true);
    console.log(`[cronometer] Nutrition: ${result.days} days`);
  }, 30_000);

  // ---- Exercises ----
  it("cronometer_exercises — exercise log", async () => {
    const tool = createCronometerExercisesTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.exercises).toBeDefined();
    expect(Array.isArray(result.exercises)).toBe(true);
    console.log(`[cronometer] Exercises: ${result.count} entries`);
  }, 30_000);

  // ---- Biometrics ----
  it("cronometer_biometrics — biometric measurements", async () => {
    const tool = createCronometerBiometricsTool(manager);
    const result = parseResult(
      await tool.execute("test", { start: "2025-01-01", account: ACCOUNT }),
    );

    expect(result.error).toBeUndefined();
    expect(result.biometrics).toBeDefined();
    expect(Array.isArray(result.biometrics)).toBe(true);
    console.log(`[cronometer] Biometrics: ${result.count} measurements`);
  }, 30_000);

  // ---- Notes ----
  it("cronometer_notes — daily notes", async () => {
    const tool = createCronometerNotesTool(manager);
    const result = parseResult(
      await tool.execute("test", { start: "2025-01-01", account: ACCOUNT }),
    );

    expect(result.error).toBeUndefined();
    expect(result.notes).toBeDefined();
    expect(Array.isArray(result.notes)).toBe(true);
    console.log(`[cronometer] Notes: ${result.count} entries`);
  }, 30_000);
});
