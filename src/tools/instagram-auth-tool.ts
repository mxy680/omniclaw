import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { InstagramClientManager, InstagramSession } from "../auth/instagram-client-manager.js";
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
export function createInstagramAuthTool(
  instagramManager: InstagramClientManager,
  config: PluginConfig,
): any {
  return {
    name: "instagram_auth_setup",
    label: "Instagram Auth Setup",
    description:
      "Authenticate with Instagram. Opens a browser for login, captures session cookies, then validates the session. The tool reads instagram_username and instagram_password from the plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      username: Type.Optional(
        Type.String({
          description: "Override for Instagram username. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for Instagram password. Usually omitted — uses pre-configured value.",
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
      const resolvedUsername = params.username ?? config.instagram_username;
      const resolvedPassword = params.password ?? config.instagram_password;

      try {
        const session = await runInstagramLoginFlow(resolvedUsername, resolvedPassword);

        instagramManager.setCredentials(account, session);

        try {
          const session = instagramManager.getCredentials(account);
          const pk = session?.ds_user_id ?? "";
          let username = "unknown";
          let fullName = "unknown";
          if (pk) {
            const profile = (await instagramManager.get(account, `users/${pk}/info/`)) as {
              user?: { username?: string; full_name?: string };
            };
            username = profile?.user?.username ?? "unknown";
            fullName = profile?.user?.full_name ?? "unknown";
          }

          return jsonResult({
            status: "authenticated",
            account,
            username,
            full_name: fullName,
          });
        } catch {
          return jsonResult({
            status: "authenticated",
            account,
            username: "unknown",
            full_name: "unknown",
            note: "Session saved but profile fetch failed. Tools may still work.",
          });
        }
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. If the user needs to update credentials, direct them to run: openclaw config set plugins.entries.omniclaw.config.instagram_password "new_password" — never ask them to type passwords in the chat.',
        });
      }
    },
  };
}

async function runInstagramLoginFlow(
  username?: string,
  password?: string,
): Promise<InstagramSession> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("[instagram] Navigating to Instagram login...");
    await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "networkidle" });

    // Dismiss cookie consent banner (EU / some regions)
    try {
      const cookieBtn = page.locator(
        'button:has-text("Allow all cookies"), button:has-text("Allow essential and optional cookies"), button:has-text("Accept All"), button:has-text("Accept"), button:has-text("Only allow essential cookies")',
      );
      await cookieBtn.first().click({ timeout: 5000 });
      console.log("[instagram] Cookie consent dismissed.");
      await page.waitForTimeout(2000);
    } catch {
      // No cookie banner — continue
    }

    // Auto-fill credentials if provided
    if (username && password) {
      console.log("[instagram] Filling credentials...");
      try {
        // Wait for JS-heavy login form to render
        // Instagram uses name="email" for username and name="pass" for password
        await page.waitForSelector('input[name="email"], input[name="username"]', { timeout: 30000 });
        const usernameInput = page.locator('input[name="email"], input[name="username"]').first();
        const passwordInput = page.locator('input[name="pass"], input[name="password"]').first();

        // Use click + type to simulate real keyboard input (React needs native events)
        await usernameInput.click();
        await usernameInput.pressSequentially(username, { delay: 30 });
        await passwordInput.click();
        await passwordInput.pressSequentially(password, { delay: 30 });
        await page.waitForTimeout(500);

        // Press Enter to submit (more reliable than clicking a potentially hidden submit button)
        await page.keyboard.press("Enter");
        console.log("[instagram] Credentials submitted.");
      } catch (e) {
        console.log(`[instagram] Login form error: ${e}`);
        console.log(`[instagram] Current URL: ${page.url()}`);
        console.log("[instagram] Waiting for manual login instead...");
      }
    } else {
      console.log("[instagram] No credentials configured — waiting for manual login...");
    }

    // Poll for sessionid cookie (up to 5 minutes)
    console.log("[instagram] Waiting for login to complete (up to 5 minutes)...");
    let loggedIn = false;

    for (let i = 0; i < 300; i++) {
      const cookies = await context.cookies();
      const sessionCookie = cookies.find((c) => c.name === "sessionid");
      if (sessionCookie) {
        console.log("[instagram] Login detected — sessionid cookie captured.");
        loggedIn = true;
        break;
      }

      if (i % 30 === 0 && i > 0) {
        console.log(`[instagram] Still waiting for login... (${i}s, URL: ${page.url().slice(0, 80)})`);
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
    const csrftoken = allCookies["csrftoken"] ?? "";
    const ds_user_id = allCookies["ds_user_id"] ?? "";
    const ig_did = allCookies["ig_did"] ?? "";
    const mid = allCookies["mid"] ?? "";

    await browser.close();

    if (!sessionid) {
      throw new Error("Failed to capture sessionid cookie after login.");
    }

    return {
      sessionid,
      csrftoken,
      ds_user_id,
      ig_did,
      mid,
      all_cookies: allCookies,
      cookie_details: cookieDetails,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
