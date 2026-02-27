import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import { type XClientManager, type XSession, X_BEARER_TOKEN } from "../auth/x-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";
import { jsonResult, QUERY_IDS } from "./x-utils.js";

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

      // Check if existing credentials are still valid via a lightweight GraphQL call
      if (manager.hasCredentials(account)) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = (await manager.graphqlGet(
            account,
            "UserByScreenName",
            QUERY_IDS.UserByScreenName,
            { screen_name: "x", withSafetyModeUserFields: true },
          )) as any;
          // If we got a response with data, the session is valid
          if (data?.data?.user) {
            const session = manager.getCredentials(account)!;
            return jsonResult({
              status: "already_authenticated",
              account,
              username: session.username,
              user_id: session.user_id,
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

  // Get user_id from the twid cookie (format: u%3D<user_id>)
  const twidCookie = finalCookies.find((c) => c.name === "twid");
  if (twidCookie) {
    const match = decodeURIComponent(twidCookie.value).match(/u=(\d+)/);
    if (match) userId = match[1];
  }

  // Try to get username via the page URL (after login, X redirects to /home)
  try {
    // Navigate to profile to extract screen_name from the URL
    const url = page.url();
    if (url.includes("x.com")) {
      // Use a script to extract the logged-in user's screen_name from the page
      username = await page.evaluate(() => {
        const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
        if (accountSwitcher) {
          const spans = Array.from(accountSwitcher.querySelectorAll("span"));
          for (const span of spans) {
            const text = span.textContent ?? "";
            if (text.startsWith("@")) return text.slice(1);
          }
        }
        return undefined;
      });
    }
  } catch {
    // Non-fatal
  }

  const cookieDetails: Record<string, string> = {};
  for (const c of finalCookies) {
    cookieDetails[c.name] = c.value;
  }

  await browser.close();
  console.log(`[x] Authenticated as @${username ?? "unknown"} (${userId ?? "unknown"})`);

  return { auth_token: authToken, ct0, username, user_id: userId, cookie_details: cookieDetails };
}
