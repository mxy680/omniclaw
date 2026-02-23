import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { LinkedInClientManager, LinkedInSession } from "../auth/linkedin-client-manager.js";
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
export function createLinkedInAuthTool(
  linkedinManager: LinkedInClientManager,
  config: PluginConfig,
): any {
  return {
    name: "linkedin_auth_setup",
    label: "LinkedIn Auth Setup",
    description:
      "Authenticate with LinkedIn. Opens a browser for login, captures session cookies (li_at + JSESSIONID), then validates the session. The tool reads linkedin_username and linkedin_password from the plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      username: Type.Optional(
        Type.String({
          description: "Override for LinkedIn email/username. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for LinkedIn password. Usually omitted — uses pre-configured value.",
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
      const resolvedUsername = params.username ?? config.linkedin_username;
      const resolvedPassword = params.password ?? config.linkedin_password;

      try {
        const session = await runLinkedInLoginFlow(resolvedUsername, resolvedPassword);

        // Validate session by calling /voyager/api/me
        linkedinManager.setCredentials(account, session);

        try {
          const profile = (await linkedinManager.get(account, "me")) as {
            included?: Array<Record<string, unknown>>;
          };
          const miniProfile = (profile.included ?? []).find(
            (item) =>
              typeof item.$type === "string" &&
              (item.$type as string).endsWith("MiniProfile"),
          );
          const name =
            miniProfile
              ? `${(miniProfile.firstName as string) ?? ""} ${(miniProfile.lastName as string) ?? ""}`.trim()
              : "unknown";

          return jsonResult({
            status: "authenticated",
            account,
            name,
          });
        } catch {
          return jsonResult({
            status: "authenticated",
            account,
            name: "unknown",
            note: "Session saved but profile fetch failed. Tools may still work.",
          });
        }
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. If the user needs to update credentials, direct them to run: openclaw config set plugins.entries.omniclaw.config.linkedin_password "new_password" — never ask them to type passwords in the chat.',
        });
      }
    },
  };
}

async function runLinkedInLoginFlow(
  username?: string,
  password?: string,
): Promise<LinkedInSession> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("[linkedin] Navigating to LinkedIn login...");
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    // Auto-fill credentials if provided
    if (username && password) {
      console.log("[linkedin] Filling credentials...");
      try {
        await page.waitForSelector("#username", { timeout: 10000 });
        await page.fill("#username", username);
        await page.fill("#password", password);

        const submit = page.locator(
          'button[type="submit"], button[data-litms-control-urn="login-submit"]',
        );
        await submit.first().click();
        console.log("[linkedin] Credentials submitted.");
      } catch (e) {
        console.log(`[linkedin] Login form error: ${e}`);
      }
    } else {
      console.log("[linkedin] No credentials configured — waiting for manual login...");
    }

    // Poll for li_at cookie (up to 5 minutes)
    console.log("[linkedin] Waiting for login to complete (up to 5 minutes)...");
    let loggedIn = false;

    for (let i = 0; i < 300; i++) {
      const cookies = await context.cookies();
      const liAt = cookies.find((c) => c.name === "li_at");
      if (liAt) {
        console.log("[linkedin] Login detected — li_at cookie captured.");
        loggedIn = true;
        break;
      }

      if (i % 30 === 0 && i > 0) {
        console.log(`[linkedin] Still waiting for login... (${i}s, URL: ${page.url().slice(0, 80)})`);
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error("Login timed out after 5 minutes waiting for li_at cookie.");
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

    const liAt = allCookies["li_at"] ?? "";
    const jsessionid = allCookies["JSESSIONID"] ?? "";
    // CSRF token is JSESSIONID with surrounding quotes stripped
    const csrfToken = jsessionid.replace(/"/g, "");

    await browser.close();

    if (!liAt) {
      throw new Error("Failed to capture li_at cookie after login.");
    }

    return {
      li_at: liAt,
      jsessionid,
      csrf_token: csrfToken,
      all_cookies: allCookies,
      cookie_details: cookieDetails,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
