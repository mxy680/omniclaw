import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { DevpostClientManager, DevpostSession } from "../auth/devpost-client-manager.js";
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
export function createDevpostAuthTool(
  devpostManager: DevpostClientManager,
  config: PluginConfig,
): any {
  return {
    name: "devpost_auth_setup",
    label: "Devpost Auth Setup",
    description:
      "Authenticate with Devpost. Opens a browser for login, captures session cookies, then validates the session. The tool reads devpost_email and devpost_password from the plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      email: Type.Optional(
        Type.String({
          description: "Override for Devpost email. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for Devpost password. Usually omitted — uses pre-configured value.",
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
      params: { email?: string; password?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const resolvedEmail = params.email ?? config.devpost_email;
      const resolvedPassword = params.password ?? config.devpost_password;

      // Check if we already have a valid session
      if (devpostManager.hasCredentials(account)) {
        try {
          const html = await devpostManager.get(account, "/settings") as string;
          if (html.includes("/users/login")) {
            // Redirected to login — session expired
          } else {
            const session = devpostManager.getCredentials(account)!;
            return jsonResult({
              status: "already_authenticated",
              account,
              username: session.username,
              message: "Existing session is still valid. No re-authentication needed.",
            });
          }
        } catch {
          // Session invalid — proceed with re-auth
        }
      }

      try {
        const session = await runDevpostLoginFlow(resolvedEmail, resolvedPassword);
        devpostManager.setCredentials(account, session);

        return jsonResult({
          status: "authenticated",
          account,
          username: session.username,
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. If the user needs to update credentials, direct them to run: openclaw config set plugins.entries.omniclaw.config.devpost_password "new_password" — never ask them to type passwords in the chat.',
        });
      }
    },
  };
}

async function runDevpostLoginFlow(
  email?: string,
  password?: string,
): Promise<DevpostSession> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("[devpost] Navigating to Devpost login...");
    await page.goto("https://secure.devpost.com/users/login", { waitUntil: "networkidle" });

    // Auto-fill credentials if provided
    if (email && password) {
      console.log("[devpost] Filling credentials...");
      try {
        await page.waitForSelector('input[type="email"], input#user_email, input[name="user[email]"]', { timeout: 10000 });
        const emailInput = page.locator('input[type="email"], input#user_email, input[name="user[email]"]').first();
        const passwordInput = page.locator('input[type="password"]').first();

        await emailInput.click();
        await emailInput.fill(email);
        await passwordInput.click();
        await passwordInput.fill(password);
        await page.waitForTimeout(500);

        const loginBtn = page.locator('input[type="submit"], button[type="submit"], button:has-text("Log in")').first();
        await loginBtn.click();
        console.log("[devpost] Credentials submitted.");
      } catch (e) {
        console.log(`[devpost] Login form error: ${e}`);
        console.log("[devpost] Waiting for manual login instead...");
      }
    } else {
      console.log("[devpost] No credentials configured — waiting for manual login...");
    }

    // Poll for successful login (up to 5 minutes)
    console.log("[devpost] Waiting for login to complete (up to 5 minutes)...");
    let loggedIn = false;

    for (let i = 0; i < 300; i++) {
      const currentUrl = page.url();

      if (
        !currentUrl.includes("/users/login") &&
        !currentUrl.includes("/users/sign_in") &&
        currentUrl.includes("devpost.com")
      ) {
        const cookies = await context.cookies();
        const sessionCookie = cookies.find(
          (c) => c.name === "_devpost_session" || c.name === "remember_user_token",
        );
        if (sessionCookie) {
          console.log("[devpost] Login detected — session cookie captured.");
          loggedIn = true;
          break;
        }
      }

      if (i % 30 === 0 && i > 0) {
        console.log(`[devpost] Still waiting for login... (${i}s, URL: ${currentUrl.slice(0, 80)})`);
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error("Login timed out after 5 minutes waiting for session cookie.");
    }

    // Extract username from the page
    let username = "unknown";
    try {
      await page.goto("https://devpost.com/settings", { waitUntil: "networkidle", timeout: 10000 });
      await page.waitForTimeout(1000);

      username = await page.evaluate(() => {
        const profileLink = document.querySelector('a[href*="devpost.com/"][class*="profile"], a[href^="/"][class*="user"]');
        if (profileLink) {
          const href = (profileLink as HTMLAnchorElement).href;
          const match = href.match(/devpost\.com\/([^/?#]+)/);
          if (match) return match[1];
        }
        const meta = document.querySelector('meta[name="user-login"], meta[property="profile:username"]');
        if (meta) return meta.getAttribute("content") ?? "";
        const nav = document.querySelector('.user-name, .username, [data-username]');
        if (nav) return nav.textContent?.trim() ?? "";
        return "";
      }) || "unknown";
    } catch {
      // Username extraction is best-effort
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

    await browser.close();

    return {
      cookies: allCookies,
      cookie_details: cookieDetails,
      username,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
