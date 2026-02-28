/**
 * Integration tests — hit the real Devpost APIs.
 *
 * No-auth tests always run. Auth tests require a valid session.
 *
 * Optional env vars:
 *   DEVPOST_EMAIL        Devpost email (enables auth tests)
 *   DEVPOST_PASSWORD     Devpost password
 *   DEVPOST_ACCOUNT      Token store account name (default: "default")
 *
 * Run:
 *   pnpm vitest run tests/integration/devpost.test.ts
 *
 * With auth:
 *   DEVPOST_EMAIL="you@example.com" DEVPOST_PASSWORD="pass" pnpm vitest run tests/integration/devpost.test.ts
 */

import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { DevpostClientManager } from "../../src/auth/devpost-client-manager.js";
import { createDevpostAuthTool } from "../../src/tools/devpost-auth-tool.js";
import {
  createDevpostSearchHackathonsTool,
  createDevpostGetHackathonTool,
  createDevpostHackathonProjectsTool,
} from "../../src/tools/devpost-hackathons.js";
import {
  createDevpostSearchProjectsTool,
  createDevpostGetProjectTool,
} from "../../src/tools/devpost-projects.js";
import {
  createDevpostGetProfileTool,
  createDevpostMyHackathonsTool,
  createDevpostMyProjectsTool,
} from "../../src/tools/devpost-profile.js";
import type { PluginConfig } from "../../src/types/plugin-config.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-devpost-tokens.json");
const ACCOUNT = process.env.DEVPOST_ACCOUNT ?? "default";
const DEVPOST_EMAIL = process.env.DEVPOST_EMAIL ?? "";
const DEVPOST_PASSWORD = process.env.DEVPOST_PASSWORD ?? "";

const authCredentialsAvailable = DEVPOST_EMAIL !== "";

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let manager: DevpostClientManager;

// ---------------------------------------------------------------------------
// No-auth tests (always run)
// ---------------------------------------------------------------------------
describe("Devpost Integration — No Auth", () => {
  beforeAll(() => {
    manager = new DevpostClientManager(TOKENS_PATH);
  });

  it("devpost_search_hackathons — returns open hackathons", async () => {
    const tool = createDevpostSearchHackathonsTool(manager);
    const result = await tool.execute("test", { status: "open" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.hackathons[0]).toHaveProperty("title");
    expect(parsed.hackathons[0]).toHaveProperty("url");
    console.log(`[integration] Found ${parsed.count} open hackathons. First: ${parsed.hackathons[0].title}`);
  });

  it("devpost_search_hackathons — returns ended hackathons", async () => {
    const tool = createDevpostSearchHackathonsTool(manager);
    const result = await tool.execute("test", { status: "ended" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.total).toBeGreaterThan(0);
  });

  it("devpost_search_projects — returns projects for a query", async () => {
    const tool = createDevpostSearchProjectsTool(manager);
    const result = await tool.execute("test", { query: "machine learning" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.query).toBe("machine learning");
    console.log(`[integration] Found ${parsed.count} projects for "machine learning"`);
  });

  it("devpost_get_project — returns project details", async () => {
    const tool = createDevpostGetProjectTool(manager);
    const result = await tool.execute("test", { project: "devpost-stats" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.title).toBeTruthy();
    expect(parsed.url).toContain("devpost.com/software/devpost-stats");
    console.log(`[integration] Project: ${parsed.title}`);
  });
});

// ---------------------------------------------------------------------------
// Auth tests (only when credentials available)
// ---------------------------------------------------------------------------
if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping Devpost auth tests: DEVPOST_EMAIL env var not set.\n",
  );
}

describe.skipIf(!authCredentialsAvailable)("Devpost Integration — Auth", () => {
  beforeAll(async () => {
    manager = new DevpostClientManager(TOKENS_PATH);

    // If we already have valid credentials, skip re-auth
    if (manager.hasCredentials(ACCOUNT)) {
      try {
        const html = (await manager.get(ACCOUNT, "/settings")) as string;
        if (!html.includes("/users/login")) {
          console.log("[integration] Reusing existing Devpost session.");
          return;
        }
      } catch {
        console.log("[integration] Existing session invalid, re-authenticating...");
      }
    }

    // Authenticate via Playwright
    const config: PluginConfig = {
      client_secret_path: "",
      devpost_email: DEVPOST_EMAIL,
      devpost_password: DEVPOST_PASSWORD,
    };
    const authTool = createDevpostAuthTool(manager, config);
    const result = await authTool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("authenticated");
    console.log(`[integration] Authenticated as ${parsed.username}`);
  }, 360_000); // 6 min timeout for manual login

  it("devpost_get_profile — returns authenticated user profile", async () => {
    const tool = createDevpostGetProfileTool(manager);
    const result = await tool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.username).toBeTruthy();
    expect(parsed.name).toBeTruthy();
    console.log(`[integration] Profile: ${parsed.name} (@${parsed.username})`);
  });

  it("devpost_my_hackathons — returns hackathon list", async () => {
    const tool = createDevpostMyHackathonsTool(manager);
    const result = await tool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.count).toBeGreaterThanOrEqual(0);
    console.log(`[integration] ${parsed.count} hackathons found.`);
  });

  it("devpost_my_projects — returns project list", async () => {
    const tool = createDevpostMyProjectsTool(manager);
    const result = await tool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.count).toBeGreaterThanOrEqual(0);
    console.log(`[integration] ${parsed.count} projects found.`);
  });
});
