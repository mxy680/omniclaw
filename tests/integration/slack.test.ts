/**
 * Integration tests — hit the real Slack Web API.
 *
 * Re-authenticates in beforeAll via slack_auth_setup (Playwright browser login)
 * to ensure a fresh session. Configuration:
 *
 *   SLACK_WORKSPACE      Slack workspace subdomain (e.g. "mycompany")
 *
 * Optional env vars:
 *   SLACK_ACCOUNT        Token store account name (default: "default")
 *
 * Run:
 *   SLACK_WORKSPACE="myworkspace" pnpm vitest run tests/integration/slack.test.ts
 */

import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { SlackClientManager } from "../../src/auth/slack-client-manager.js";
import { createSlackAuthTool } from "../../src/tools/slack-auth-tool.js";
import { createSlackListChannelsTool, createSlackGetChannelInfoTool } from "../../src/tools/slack-channels.js";
import { createSlackListMessagesTool, createSlackGetThreadTool } from "../../src/tools/slack-messages.js";
import { createSlackSearchMessagesTool } from "../../src/tools/slack-search.js";
import { createSlackListUsersTool, createSlackGetUserInfoTool } from "../../src/tools/slack-users.js";
import type { PluginConfig } from "../../src/types/plugin-config.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-slack-tokens.json");
const ACCOUNT = process.env.SLACK_ACCOUNT ?? "default";
const SLACK_WORKSPACE = process.env.SLACK_WORKSPACE ?? "";

const authCredentialsAvailable = SLACK_WORKSPACE !== "";

if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping Slack tests: SLACK_WORKSPACE env var not set.\n",
  );
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let manager: SlackClientManager;
let firstChannelId = "";
let firstUserId = "";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe.skipIf(!authCredentialsAvailable)("Slack Integration", () => {
  beforeAll(async () => {
    manager = new SlackClientManager(TOKENS_PATH);

    // If we already have valid credentials, skip re-auth
    if (manager.hasCredentials(ACCOUNT)) {
      try {
        // Quick validation
        await manager.post(ACCOUNT, "auth.test");
        console.log("[integration] Reusing existing Slack session.");
        return;
      } catch {
        console.log("[integration] Existing session invalid, re-authenticating...");
      }
    }

    // Authenticate via Playwright
    const config: PluginConfig = {
      client_secret_path: "",
      slack_workspace: SLACK_WORKSPACE,
    };
    const authTool = createSlackAuthTool(manager, config);
    const result = await authTool.execute("test", { account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("authenticated");
    console.log(`[integration] Authenticated as user ${parsed.user_id} in team ${parsed.team_name}`);
  }, 360_000); // 6 min timeout for manual login

  // -----------------------------------------------------------------------
  // Channels
  // -----------------------------------------------------------------------
  it("slack_list_channels — returns channels", async () => {
    const tool = createSlackListChannelsTool(manager);
    const result = await tool.execute("test", { account: ACCOUNT, limit: 10 });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.channels[0]).toHaveProperty("id");
    expect(parsed.channels[0]).toHaveProperty("name");

    firstChannelId = parsed.channels[0].id;
    console.log(`[integration] First channel: ${parsed.channels[0].name} (${firstChannelId})`);
  });

  it("slack_get_channel_info — returns channel details", async () => {
    expect(firstChannelId).toBeTruthy();

    const tool = createSlackGetChannelInfoTool(manager);
    const result = await tool.execute("test", { channel: firstChannelId, account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.id).toBe(firstChannelId);
    expect(parsed).toHaveProperty("name");
  });

  // -----------------------------------------------------------------------
  // Messages
  // -----------------------------------------------------------------------
  it("slack_list_messages — returns messages from a channel", async () => {
    expect(firstChannelId).toBeTruthy();

    const tool = createSlackListMessagesTool(manager);
    const result = await tool.execute("test", {
      channel: firstChannelId,
      limit: 5,
      account: ACCOUNT,
    });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(Array.isArray(parsed.messages)).toBe(true);
    // Channel might be empty, so just verify structure
    if (parsed.count > 0) {
      expect(parsed.messages[0]).toHaveProperty("text");
      expect(parsed.messages[0]).toHaveProperty("ts");
    }
  });

  it("slack_get_thread — returns thread replies", async () => {
    expect(firstChannelId).toBeTruthy();

    // First find a message with a thread
    const listTool = createSlackListMessagesTool(manager);
    const listResult = await listTool.execute("test", {
      channel: firstChannelId,
      limit: 50,
      account: ACCOUNT,
    });
    const listParsed = JSON.parse(listResult.content[0].text);
    const threadedMsg = listParsed.messages?.find(
      (m: { reply_count: number | null }) => m.reply_count && m.reply_count > 0,
    );

    if (!threadedMsg) {
      console.log("[integration] No threaded messages found — skipping thread test.");
      return;
    }

    const tool = createSlackGetThreadTool(manager);
    const result = await tool.execute("test", {
      channel: firstChannelId,
      thread_ts: threadedMsg.ts,
      account: ACCOUNT,
    });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.count).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------
  it("slack_search_messages — returns search results", async () => {
    const tool = createSlackSearchMessagesTool(manager);
    const result = await tool.execute("test", {
      query: "hello",
      count: 5,
      account: ACCOUNT,
    });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed).toHaveProperty("total");
    expect(Array.isArray(parsed.matches)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Users
  // -----------------------------------------------------------------------
  it("slack_list_users — returns workspace members", async () => {
    const tool = createSlackListUsersTool(manager);
    const result = await tool.execute("test", { limit: 10, account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.users[0]).toHaveProperty("id");
    expect(parsed.users[0]).toHaveProperty("name");

    // Find a non-bot user for the user_info test
    const realUser = parsed.users.find(
      (u: { is_bot: boolean; deleted: boolean }) => !u.is_bot && !u.deleted,
    );
    firstUserId = realUser?.id ?? parsed.users[0].id;
    console.log(`[integration] First user: ${realUser?.display_name ?? "?"} (${firstUserId})`);
  });

  it("slack_get_user_info — returns user profile", async () => {
    expect(firstUserId).toBeTruthy();

    const tool = createSlackGetUserInfoTool(manager);
    const result = await tool.execute("test", { user: firstUserId, account: ACCOUNT });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.error).toBeUndefined();
    expect(parsed.id).toBe(firstUserId);
    expect(parsed).toHaveProperty("real_name");
  });
});
