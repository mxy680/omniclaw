import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { Factor75ClientManager, Factor75Session } from "../auth/factor75-client-manager.js";
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
export function createFactor75AuthTool(
  manager: Factor75ClientManager,
  config: PluginConfig,
): any {
  return {
    name: "factor75_auth_setup",
    label: "Factor75 Auth Setup",
    description:
      "Authenticate with Factor75 (factor.com). Logs in via browser automation, captures JWT tokens, then validates the session. The tool reads factor75_email and factor75_password from the plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      email: Type.Optional(
        Type.String({
          description: "Override for Factor75 email. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for Factor75 password. Usually omitted — uses pre-configured value.",
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
      const resolvedEmail = params.email ?? config.factor75_email;
      const resolvedPassword = params.password ?? config.factor75_password;

      if (!resolvedEmail || !resolvedPassword) {
        return jsonResult({
          status: "error",
          error: "No Factor75 credentials configured.",
          hint: 'Run: openclaw config set plugins.entries.omniclaw.config.factor75_email "you@example.com" and openclaw config set plugins.entries.omniclaw.config.factor75_password "yourpass"',
        });
      }

      // Check if we already have a valid session
      if (manager.hasCredentials(account)) {
        try {
          const creds = manager.getCredentials(account)!;
          const info = (await manager.get(
            account,
            "api/customers/me/info",
            { country: creds.country, locale: "en-US" },
          )) as { id?: string; firstName?: string; lastName?: string; email?: string };
          return jsonResult({
            status: "already_authenticated",
            account,
            user_id: info?.id ?? creds.user_id,
            email: info?.email ?? resolvedEmail,
            name: [info?.firstName, info?.lastName].filter(Boolean).join(" ") || "unknown",
            message: "Existing session is still valid. No re-authentication needed.",
          });
        } catch {
          // Session invalid — proceed with re-auth
        }
      }

      try {
        const session = await runFactor75LoginFlow(resolvedEmail, resolvedPassword);

        manager.setCredentials(account, session);

        // Validate with the customer info REST endpoint using the session's country.
        try {
          const info = (await manager.get(
            account,
            "api/customers/me/info",
            { country: session.country, locale: "en-US" },
          )) as { id?: string; firstName?: string; lastName?: string; email?: string };

          return jsonResult({
            status: "authenticated",
            account,
            user_id: info?.id ?? session.user_id,
            email: info?.email ?? resolvedEmail,
            name: [info?.firstName, info?.lastName].filter(Boolean).join(" ") || "unknown",
          });
        } catch {
          return jsonResult({
            status: "authenticated",
            account,
            user_id: session.user_id,
            note: "Session saved but profile validation call failed. Tools may still work.",
          });
        }
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. If the user needs to update credentials, direct them to run: openclaw config set plugins.entries.omniclaw.config.factor75_password "new_password" — never ask them to type passwords in the chat.',
        });
      }
    },
  };
}

async function runFactor75LoginFlow(
  email: string,
  password: string,
): Promise<Factor75Session> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  // Factor75 uses the hf_system_country cookie to determine which country's
  // auth service to hit. Without this, geolocation may resolve to the wrong
  // country (e.g. "FJ") causing login to fail.
  await context.addCookies([
    {
      name: "hf_system_country",
      value: "US",
      domain: ".factor75.com",
      path: "/",
    },
  ]);

  const page = await context.newPage();

  let capturedToken: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    user_id?: string;
    user_data?: {
      id?: string;
      country?: string;
      email?: string;
      username?: string;
      blocked?: boolean;
    };
  } | null = null;

  // Intercept auth-service responses to capture the JWT
  page.on("response", async (response) => {
    const url = response.url();
    if (
      url.includes("/gw/login") ||
      url.includes("auth-service") ||
      url.includes("/auth/") ||
      url.includes("/token")
    ) {
      try {
        const ct = response.headers()["content-type"] ?? "";
        if (ct.includes("application/json") && response.status() === 200) {
          const body = await response.json();
          if (body.access_token) {
            capturedToken = body;
            console.log("[factor75] JWT captured from auth response.");
          }
        }
      } catch {
        // Ignore non-JSON responses
      }
    }
  });

  try {
    console.log("[factor75] Navigating to Factor75 login...");

    // Navigate with a short timeout — if the page doesn't fully load, that's
    // fine as long as the login form renders. factor75.com has persistent
    // network connections that prevent networkidle/load from ever firing.
    try {
      await page.goto("https://www.factor75.com/login", {
        waitUntil: "commit",
        timeout: 30000,
      });
    } catch (navErr) {
      // Even if navigation "times out", the page may have partially loaded.
      // Check if we can still interact with it.
      console.log(`[factor75] Navigation note: ${navErr instanceof Error ? navErr.message : navErr}`);
    }

    // Wait for the login form to appear — this is the real signal that the
    // page is usable, regardless of whether all resources have loaded.
    // Factor75's form uses name="INPUT_EMAIL" and name="INPUT_PASSWORD".
    console.log("[factor75] Waiting for login form...");
    await page.waitForSelector(
      'input#INPUT_EMAIL, input[name="INPUT_EMAIL"], input[type="email"], input[name="email"]',
      { timeout: 45000 },
    );
    console.log("[factor75] Login form found.");

    // Dismiss cookie consent if present
    try {
      const cookieBtn = page.locator(
        'button:has-text("Accept All"), button:has-text("Accept"), button:has-text("Allow"), button:has-text("Got it")',
      );
      await cookieBtn.first().click({ timeout: 3000 });
      console.log("[factor75] Cookie consent dismissed.");
      await page.waitForTimeout(500);
    } catch {
      // No cookie banner
    }

    // Fill credentials — Factor75 uses INPUT_EMAIL / INPUT_PASSWORD field names
    console.log("[factor75] Filling credentials...");
    const emailInput = page.locator(
      'input#INPUT_EMAIL, input[name="INPUT_EMAIL"], input[type="email"], input[name="email"]',
    ).first();
    const passwordInput = page.locator(
      'input#INPUT_PASSWORD, input[name="INPUT_PASSWORD"], input[type="password"], input[name="password"]',
    ).first();

    await emailInput.click();
    await emailInput.pressSequentially(email, { delay: 30 });
    await passwordInput.click();
    await passwordInput.pressSequentially(password, { delay: 30 });
    await page.waitForTimeout(500);

    // Click the login/submit button or press Enter
    try {
      const submitBtn = page.locator(
        'button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")',
      ).first();
      await submitBtn.click({ timeout: 3000 });
    } catch {
      await page.keyboard.press("Enter");
    }
    console.log("[factor75] Credentials submitted.");

    // Poll for JWT capture (up to 2 minutes — login should be fast)
    console.log("[factor75] Waiting for JWT token...");
    let loggedIn = false;

    for (let i = 0; i < 120; i++) {
      if (capturedToken) {
        loggedIn = true;
        break;
      }

      // Check URL for post-login redirect
      const currentUrl = page.url();
      if (
        i > 5 &&
        !capturedToken &&
        (currentUrl.includes("/my-account") ||
          currentUrl.includes("/menu") ||
          currentUrl.includes("/my-box") ||
          (currentUrl === "https://www.factor75.com/" && i > 10))
      ) {
        // Try to grab token from localStorage
        try {
          const storageData = await page.evaluate(() => {
            const keys = Object.keys(localStorage);
            const result: Record<string, string> = {};
            for (const k of keys) {
              if (
                k.includes("token") ||
                k.includes("auth") ||
                k.includes("user") ||
                k.includes("hf_")
              ) {
                result[k] = localStorage.getItem(k) ?? "";
              }
            }
            return result;
          });

          for (const [, value] of Object.entries(storageData)) {
            try {
              const parsed = JSON.parse(value);
              if (parsed.access_token) {
                capturedToken = parsed;
                loggedIn = true;
                break;
              }
            } catch {
              if (value.length > 20 && value.includes(".")) {
                capturedToken = {
                  access_token: value,
                  refresh_token: "",
                  token_type: "Bearer",
                  expires_in: 2592000,
                };
                loggedIn = true;
                break;
              }
            }
          }
          if (loggedIn) break;
        } catch {
          // Continue polling
        }
      }

      if (i % 15 === 0 && i > 0) {
        console.log(
          `[factor75] Waiting for JWT... (${i}s, URL: ${page.url().slice(0, 80)})`,
        );
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn || !capturedToken) {
      throw new Error("Login timed out after 2 minutes. No JWT token was captured.");
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

    const expiresAt = Math.floor(Date.now() / 1000) + (capturedToken.expires_in || 2592000);

    const rawCountry = capturedToken.user_data?.country ?? "US";
    const country = rawCountry.toUpperCase();
    const userId =
      capturedToken.user_data?.id ?? capturedToken.user_id ?? "";

    return {
      access_token: capturedToken.access_token,
      refresh_token: capturedToken.refresh_token || "",
      token_type: capturedToken.token_type || "Bearer",
      expires_at: expiresAt,
      user_id: userId,
      country,
      all_cookies: allCookies,
      cookie_details: cookieDetails,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
