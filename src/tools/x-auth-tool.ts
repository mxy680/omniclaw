import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { XClientManager, XSession } from "../auth/x-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";
import { jsonResult } from "./x-utils.js";

export function createXAuthTool(manager: XClientManager, _config: PluginConfig) {
  return {
    name: "x_auth_setup",
    label: "X Auth Setup",
    description:
      "Authenticate with X (Twitter) via browser login. Opens a browser window where you log in manually. Captures session cookies for subsequent API calls.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name for multi-account support. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";

      // Check if existing credentials are still valid
      if (manager.hasCredentials(account)) {
        try {
          const session = manager.getCredentials(account)!;
          const resp = await fetch("https://api.x.com/1.1/account/settings.json", {
            headers: {
              Authorization:
                "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
              "x-csrf-token": session.ct0,
              Cookie: `auth_token=${session.auth_token}; ct0=${session.ct0}`,
            },
          });
          if (resp.ok) {
            const settings = (await resp.json()) as { screen_name?: string };
            return jsonResult({
              status: "already_authenticated",
              account,
              username: settings.screen_name ?? session.username,
            });
          }
        } catch {
          // Proceed to re-authenticate
        }
      }

      const session = await runXLoginFlow();
      manager.setCredentials(account, session);

      return jsonResult({
        status: "authenticated",
        account,
        username: session.username,
        user_id: session.user_id,
      });
    },
  };
}

async function runXLoginFlow(): Promise<XSession> {
  console.log("[x] Launching browser for X login...");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  await page.goto("https://x.com/i/flow/login");
  console.log("[x] Please log in to X in the browser window...");

  let authToken = "";
  let ct0 = "";

  for (let i = 0; i < 300; i++) {
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === "auth_token" && c.value !== "");
    const ct0Cookie = cookies.find((c) => c.name === "ct0" && c.value !== "");

    if (authCookie && ct0Cookie) {
      authToken = authCookie.value;
      ct0 = ct0Cookie.value;
      console.log("[x] Login detected! Capturing session...");
      break;
    }

    await page.waitForTimeout(1000);
  }

  if (!authToken || !ct0) {
    await browser.close();
    throw new Error("X login timed out after 5 minutes. No auth_token cookie found.");
  }

  // Give the page a moment to settle after login
  await page.waitForTimeout(2000);

  // Re-read ct0 (it may refresh after page load)
  const finalCookies = await context.cookies();
  const finalCt0 = finalCookies.find((c) => c.name === "ct0");
  if (finalCt0) ct0 = finalCt0.value;

  let username: string | undefined;
  let userId: string | undefined;

  try {
    const settings = await fetch("https://api.x.com/1.1/account/settings.json", {
      headers: {
        Authorization:
          "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
        "x-csrf-token": ct0,
        Cookie: `auth_token=${authToken}; ct0=${ct0}`,
      },
    });
    if (settings.ok) {
      const data = (await settings.json()) as { screen_name?: string };
      username = data.screen_name;
    }
  } catch {
    // Non-fatal
  }

  // Get user_id from the twid cookie (format: u%3D<user_id>)
  const twidCookie = finalCookies.find((c) => c.name === "twid");
  if (twidCookie) {
    const match = decodeURIComponent(twidCookie.value).match(/u=(\d+)/);
    if (match) userId = match[1];
  }

  const cookieDetails: Record<string, string> = {};
  for (const c of finalCookies) {
    cookieDetails[c.name] = c.value;
  }

  await browser.close();
  console.log(`[x] Authenticated as @${username ?? "unknown"} (${userId ?? "unknown"})`);

  return { auth_token: authToken, ct0, username, user_id: userId, cookie_details: cookieDetails };
}
