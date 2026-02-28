import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { TikTokClientManager, TikTokSession } from "../auth/tiktok-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTikTokAuthTool(
  tiktokManager: TikTokClientManager,
  config: PluginConfig,
): any {
  return {
    name: "tiktok_auth_setup",
    label: "TikTok Auth Setup",
    description:
      "Authenticate with TikTok. Opens a browser for login, captures session cookies, then validates the session. The tool reads tiktok_username and tiktok_password from the plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      username: Type.Optional(
        Type.String({
          description: "Override for TikTok username/email. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for TikTok password. Usually omitted — uses pre-configured value.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'personal'). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { username?: string; password?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const resolvedUsername = params.username ?? config.tiktok_username;
      const resolvedPassword = params.password ?? config.tiktok_password;

      // Check if we already have a valid session
      if (tiktokManager.hasCredentials(account)) {
        try {
          const data = await tiktokManager.getUserDetail(account, "me");
          const user = data?.userInfo?.user;
          if (user?.uniqueId) {
            return jsonResult({
              status: "already_authenticated",
              account,
              username: user.uniqueId as string,
              nickname: (user.nickname as string) ?? "unknown",
              message: "Existing session is still valid. No re-authentication needed.",
            });
          }
        } catch {
          // Session invalid — proceed with re-auth
        }
      }

      try {
        const session = await runTikTokLoginFlow(resolvedUsername, resolvedPassword);

        tiktokManager.setCredentials(account, session);

        try {
          const data = await tiktokManager.getUserDetail(account, "me");
          const user = data?.userInfo?.user;

          return jsonResult({
            status: "authenticated",
            account,
            username: (user?.uniqueId as string) ?? "unknown",
            nickname: (user?.nickname as string) ?? "unknown",
          });
        } catch {
          return jsonResult({
            status: "authenticated",
            account,
            username: "unknown",
            nickname: "unknown",
            note: "Session saved but profile fetch failed. Tools may still work.",
          });
        }
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. If the user needs to update credentials, direct them to run: openclaw config set plugins.entries.omniclaw.config.tiktok_password "new_password" — never ask them to type passwords in the chat.',
        });
      }
    },
  };
}

async function runTikTokLoginFlow(
  username?: string,
  password?: string,
): Promise<TikTokSession> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("[tiktok] Navigating to TikTok login...");
    await page.goto("https://www.tiktok.com/login/phone-or-email/email", { waitUntil: "networkidle" });

    // Dismiss cookie consent banner
    try {
      const cookieBtn = page.locator(
        'button:has-text("Accept all"), button:has-text("Allow all cookies"), button:has-text("Accept cookies")',
      );
      await cookieBtn.first().click({ timeout: 5000 });
      console.log("[tiktok] Cookie consent dismissed.");
      await page.waitForTimeout(2000);
    } catch {
      // No cookie banner — continue
    }

    // Auto-fill credentials if provided
    if (username && password) {
      console.log("[tiktok] Filling credentials...");
      try {
        await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 30000 });
        const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
        const passwordInput = page.locator('input[type="password"]').first();

        await usernameInput.click();
        await usernameInput.pressSequentially(username, { delay: 30 });
        await passwordInput.click();
        await passwordInput.pressSequentially(password, { delay: 30 });
        await page.waitForTimeout(500);

        // Click login button (TikTok uses a button, not Enter)
        const loginBtn = page.locator('button[type="submit"], button:has-text("Log in")').first();
        await loginBtn.click();
        console.log("[tiktok] Credentials submitted.");
      } catch (e) {
        console.log(`[tiktok] Login form error: ${e}`);
        console.log(`[tiktok] Current URL: ${page.url()}`);
        console.log("[tiktok] Waiting for manual login instead...");
      }
    } else {
      console.log("[tiktok] No credentials configured — waiting for manual login...");
    }

    // Poll for sessionid cookie (up to 5 minutes)
    console.log("[tiktok] Waiting for login to complete (up to 5 minutes)...");
    let loggedIn = false;

    for (let i = 0; i < 300; i++) {
      const cookies = await context.cookies();
      const sessionCookie = cookies.find((c) => c.name === "sessionid");
      if (sessionCookie && sessionCookie.value) {
        console.log("[tiktok] Login detected — sessionid cookie captured.");
        loggedIn = true;
        break;
      }

      if (i % 30 === 0 && i > 0) {
        console.log(`[tiktok] Still waiting for login... (${i}s, URL: ${page.url().slice(0, 80)})`);
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error("Login timed out after 5 minutes waiting for sessionid cookie.");
    }

    // Capture all cookies
    const finalCookies = await context.cookies();
    const allCookies: Record<string, string> = {};
    const cookieDetails: Array<{ name: string; value: string; domain: string; path: string }> = [];
    for (const c of finalCookies) {
      allCookies[c.name] = c.value;
      cookieDetails.push({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
      });
    }

    const sessionid = allCookies["sessionid"] ?? "";
    const tt_csrf_token = allCookies["tt_csrf_token"] ?? allCookies["csrf_token"] ?? "";
    const msToken = allCookies["msToken"] ?? "";
    const tt_webid_v2 = allCookies["tt_webid_v2"] ?? allCookies["tt_webid"] ?? "";

    await browser.close();

    if (!sessionid) {
      throw new Error("Failed to capture sessionid cookie after login.");
    }

    return {
      sessionid,
      tt_csrf_token,
      msToken,
      tt_webid_v2,
      all_cookies: allCookies,
      cookie_details: cookieDetails,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
