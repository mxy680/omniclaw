/**
 * Integration tests — hit the real Factor75 / HelloFresh API.
 *
 * Re-authenticates in beforeAll via factor75_auth_setup (Playwright browser login)
 * to ensure a fresh JWT. Credentials are read from the openclaw config file
 * (~/.openclaw/openclaw.json), with env var overrides:
 *   FACTOR75_EMAIL       Factor75 account email
 *   FACTOR75_PASSWORD    Factor75 account password
 *
 * Optional env vars:
 *   FACTOR75_ACCOUNT     Token store account name (default: "default")
 *   RUN_WRITE_TESTS      Set to "1" to enable mutating tests (select/remove/skip)
 *
 * Run:
 *   FACTOR75_EMAIL="..." FACTOR75_PASSWORD="..." pnpm vitest run tests/integration/factor75.test.ts
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { Factor75ClientManager } from "../../src/auth/factor75-client-manager.js";
import { createFactor75AuthTool } from "../../src/tools/factor75-auth-tool.js";
import { createFactor75MenuTool } from "../../src/tools/factor75-menu.js";
import { createFactor75MealDetailsTool } from "../../src/tools/factor75-meal-details.js";
import {
  createFactor75GetSelectionsTool,
  createFactor75SelectMealTool,
  createFactor75RemoveMealTool,
} from "../../src/tools/factor75-selections.js";
import {
  createFactor75SubscriptionTool,
  createFactor75SkipWeekTool,
  createFactor75PauseTool,
  createFactor75ResumeTool,
} from "../../src/tools/factor75-subscription.js";
import {
  createFactor75DeliveriesTool,
  createFactor75DeliveryDetailsTool,
} from "../../src/tools/factor75-deliveries.js";
import { createFactor75AccountTool } from "../../src/tools/factor75-account.js";

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

const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-factor75-tokens.json");
const ACCOUNT = process.env.FACTOR75_ACCOUNT ?? "default";

const FACTOR75_EMAIL = process.env.FACTOR75_EMAIL || oclConfig.factor75_email || "";
const FACTOR75_PASSWORD = process.env.FACTOR75_PASSWORD || oclConfig.factor75_password || "";

const authCredentialsAvailable = FACTOR75_EMAIL !== "" && FACTOR75_PASSWORD !== "";

if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping Factor75 tests: auth credentials not found in " +
      "~/.openclaw/openclaw.json or env vars.\n",
  );
}

const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let manager: Factor75ClientManager;
let firstMealId = "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResult(result: any): any {
  const text = result?.content?.[0]?.text;
  return text ? JSON.parse(text) : result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe.skipIf(!authCredentialsAvailable)("Factor75 integration", () => {
  beforeAll(async () => {
    manager = new Factor75ClientManager(TOKENS_PATH);

    // Authenticate if no existing valid session
    if (!manager.hasCredentials(ACCOUNT) || manager.isTokenExpired(ACCOUNT)) {
      const authTool = createFactor75AuthTool(manager, {
        client_secret_path: "",
        factor75_email: FACTOR75_EMAIL,
        factor75_password: FACTOR75_PASSWORD,
      });
      const result = parseResult(await authTool.execute("test", { account: ACCOUNT }));
      expect(result.status).toBe("authenticated");
      console.log("[factor75] Authenticated as:", result.email ?? result.user_id);
    } else {
      console.log("[factor75] Using existing session for account:", ACCOUNT);
    }
  }, 120_000);

  // ---- Menu ----
  it("factor75_menu — lists weekly meals", async () => {
    const tool = createFactor75MenuTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.meals).toBeDefined();
    expect(Array.isArray(result.meals)).toBe(true);
    expect(result.count).toBeGreaterThan(0);

    // Save first meal ID for detail test
    if (result.meals.length > 0 && result.meals[0].id) {
      firstMealId = String(result.meals[0].id);
    }

    console.log(`[factor75] Menu: ${result.count} meals available`);
  }, 30_000);

  it("factor75_menu — filters by diet", async () => {
    const tool = createFactor75MenuTool(manager);
    const result = parseResult(
      await tool.execute("test", { filter: "keto", account: ACCOUNT }),
    );

    expect(result.error).toBeUndefined();
    expect(result.meals).toBeDefined();
    console.log(`[factor75] Keto meals: ${result.count}`);
  }, 30_000);

  // ---- Meal Details ----
  it("factor75_meal_details — gets full info", async () => {
    if (!firstMealId) {
      console.warn("[factor75] Skipping meal_details: no meal ID from menu test");
      return;
    }

    const tool = createFactor75MealDetailsTool(manager);
    const result = parseResult(
      await tool.execute("test", { meal_id: firstMealId, account: ACCOUNT }),
    );

    expect(result.error).toBeUndefined();
    expect(result.name).toBeDefined();
    console.log(`[factor75] Meal details: ${result.name}`);
  }, 30_000);

  // ---- Account ----
  it("factor75_account — gets account info", async () => {
    const tool = createFactor75AccountTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.email).toBeDefined();
    console.log(`[factor75] Account: ${result.email}`);
  }, 30_000);

  // ---- Subscription ----
  it("factor75_subscription — gets plan info", async () => {
    const tool = createFactor75SubscriptionTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.status).toBeDefined();
    console.log(`[factor75] Subscription status: ${result.status}`);
  }, 30_000);

  // ---- Deliveries ----
  it("factor75_deliveries — lists deliveries", async () => {
    const tool = createFactor75DeliveriesTool(manager);
    const result = parseResult(await tool.execute("test", { count: 3, account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.deliveries).toBeDefined();
    expect(Array.isArray(result.deliveries)).toBe(true);
    console.log(`[factor75] Deliveries: ${result.count}`);
  }, 30_000);

  // ---- Selections ----
  it("factor75_get_selections — gets current picks", async () => {
    const tool = createFactor75GetSelectionsTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.selected_meals).toBeDefined();
    console.log(
      `[factor75] Selections: ${result.selected_count}/${result.meals_per_week}`,
    );
  }, 30_000);

  // ---- Write Tests (gated) ----
  describe.skipIf(!RUN_WRITE_TESTS)("write operations", () => {
    it("factor75_select_meal + factor75_remove_meal", async () => {
      if (!firstMealId) {
        console.warn("[factor75] Skipping select/remove: no meal ID");
        return;
      }

      const selectTool = createFactor75SelectMealTool(manager);
      const selectResult = parseResult(
        await selectTool.execute("test", { meal_id: firstMealId, account: ACCOUNT }),
      );
      console.log(`[factor75] Select meal result: ${selectResult.status}`);

      // Only attempt remove if select succeeded
      if (selectResult.status === "meal_added") {
        const removeTool = createFactor75RemoveMealTool(manager);
        const removeResult = parseResult(
          await removeTool.execute("test", { meal_id: firstMealId, account: ACCOUNT }),
        );
        expect(removeResult.status).toBe("meal_removed");
        console.log(`[factor75] Remove meal result: ${removeResult.status}`);
      }
    }, 30_000);

    it("factor75_skip_week — skips a future week", async () => {
      // Calculate a week ~4 weeks out to be safe
      const now = new Date();
      now.setDate(now.getDate() + 28);
      const year = now.getFullYear();
      const weekNum = Math.ceil(
        ((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7,
      );
      const week = `${year}-W${String(weekNum).padStart(2, "0")}`;

      const tool = createFactor75SkipWeekTool(manager);
      const result = parseResult(
        await tool.execute("test", { week, account: ACCOUNT }),
      );
      console.log(`[factor75] Skip week ${week}: ${result.status}`);
    }, 30_000);

    // NOTE: pause/resume NOT tested — too dangerous for real subscription
  });
});
