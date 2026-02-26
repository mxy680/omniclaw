import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { CronometerClientManager, CronometerSession } from "../auth/cronometer-client-manager.js";
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
export function createCronometerAuthTool(
  manager: CronometerClientManager,
  config: PluginConfig,
): any {
  return {
    name: "cronometer_auth_setup",
    label: "Cronometer Auth Setup",
    description:
      "Authenticate with Cronometer (cronometer.com). Logs in via browser automation, captures session tokens and GWT values, then validates. Reads cronometer_email and cronometer_password from plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      email: Type.Optional(
        Type.String({
          description: "Override for Cronometer email. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for Cronometer password. Usually omitted — uses pre-configured value.",
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
      const resolvedEmail = params.email ?? config.cronometer_email;
      const resolvedPassword = params.password ?? config.cronometer_password;

      if (!resolvedEmail || !resolvedPassword) {
        return jsonResult({
          status: "error",
          error: "No Cronometer credentials configured.",
          hint: 'Run: openclaw config set plugins.entries.omniclaw.config.cronometer_email "you@example.com" and openclaw config set plugins.entries.omniclaw.config.cronometer_password "yourpass"',
        });
      }

      try {
        const session = await runCronometerLoginFlow(resolvedEmail, resolvedPassword);
        manager.setCredentials(account, session);

        return jsonResult({
          status: "authenticated",
          account,
          user_id: session.user_id,
          note: "Session saved. All Cronometer tools are now available.",
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. If credentials need updating, direct them to run: openclaw config set plugins.entries.omniclaw.config.cronometer_password "new_password"',
        });
      }
    },
  };
}

async function runCronometerLoginFlow(
  email: string,
  password: string,
): Promise<CronometerSession> {
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
  const page = await context.newPage();

  // Discovered GWT values — populated by intercepting outgoing requests
  let gwtPermutation = "";
  let gwtModuleBase = "";
  let gwtHeader = "";
  const gwtContentType = "text/x-gwt-rpc; charset=UTF-8";

  // Intercept outgoing GWT requests to discover magic values
  page.on("request", (request) => {
    const headers = request.headers();
    if (headers["x-gwt-permutation"] && !gwtPermutation) {
      gwtPermutation = headers["x-gwt-permutation"];
      gwtModuleBase = headers["x-gwt-module-base"] ?? "https://cronometer.com/cronometer/";
      console.log(`[cronometer] Discovered GWT permutation: ${gwtPermutation}`);
    }
    // Also try to extract the GWT header from request bodies
    if (request.url().includes("/cronometer/app")) {
      try {
        const body = request.postData();
        if (body) {
          // GWT body format: 7|0|N|moduleBase|HEADER|...
          const parts = body.split("|");
          if (parts.length >= 5 && parts[3]?.includes("cronometer")) {
            gwtHeader = parts[4];
          }
        }
      } catch {
        // ignore
      }
    }
  });

  try {
    console.log("[cronometer] Navigating to Cronometer login...");
    try {
      await page.goto("https://cronometer.com/login/", {
        waitUntil: "commit",
        timeout: 30000,
      });
    } catch (navErr) {
      console.log(`[cronometer] Navigation note: ${navErr instanceof Error ? navErr.message : navErr}`);
    }

    // Wait for login form
    console.log("[cronometer] Waiting for login form...");
    await page.waitForSelector(
      'input[name="username"], input[type="email"], input#username',
      { timeout: 45000 },
    );
    console.log("[cronometer] Login form found.");

    // Extract CSRF token
    let anticsrf = "";
    try {
      anticsrf = await page.evaluate(() => {
        const input = document.querySelector('input[name="anticsrf"]') as HTMLInputElement | null;
        return input?.value ?? "";
      });
      if (anticsrf) {
        console.log(`[cronometer] CSRF token captured: ${anticsrf.slice(0, 8)}...`);
      }
    } catch {
      console.log("[cronometer] No CSRF token found on page.");
    }

    // Dismiss cookie consent if present
    try {
      const cookieBtn = page.locator(
        'button:has-text("Accept All"), button:has-text("Accept"), button:has-text("Allow"), button:has-text("Got it")',
      );
      await cookieBtn.first().click({ timeout: 3000 });
      console.log("[cronometer] Cookie consent dismissed.");
      await page.waitForTimeout(500);
    } catch {
      // No cookie banner
    }

    // Fill credentials
    console.log("[cronometer] Filling credentials...");
    const emailInput = page.locator(
      'input[name="username"], input[type="email"], input#username',
    ).first();
    const passwordInput = page.locator(
      'input[name="password"], input[type="password"], input#password',
    ).first();

    await emailInput.click();
    await emailInput.pressSequentially(email, { delay: 30 });
    await passwordInput.click();
    await passwordInput.pressSequentially(password, { delay: 30 });
    await page.waitForTimeout(500);

    // Submit
    try {
      const submitBtn = page.locator(
        'button[type="submit"], input[type="submit"], button:has-text("Log In"), button:has-text("Sign In")',
      ).first();
      await submitBtn.click({ timeout: 3000 });
    } catch {
      await page.keyboard.press("Enter");
    }
    console.log("[cronometer] Credentials submitted.");

    // Wait for redirect to the app (post-login URL contains /cronometer or /#)
    console.log("[cronometer] Waiting for post-login redirect...");
    let loggedIn = false;
    for (let i = 0; i < 60; i++) {
      const url = page.url();
      if (url.includes("cronometer.com/#") || url.includes("/cronometer/#") || url.includes("/food-diary")) {
        loggedIn = true;
        break;
      }
      // Check for error messages
      try {
        const errorText = await page.evaluate(() => {
          const el = document.querySelector(".error-message, .alert-danger, .login-error");
          return el?.textContent?.trim() ?? "";
        });
        if (errorText) {
          throw new Error(`Cronometer login failed: ${errorText}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("login failed")) throw e;
      }
      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error("Cronometer login timed out. Check credentials or try again.");
    }
    console.log("[cronometer] Login successful. Extracting session...");

    // Wait a moment for GWT app to load and make requests (so we capture GWT values)
    await page.waitForTimeout(3000);

    // Extract cookies
    const cookies = await context.cookies();
    const allCookies: Record<string, string> = {};
    let sesnonce = "";
    for (const c of cookies) {
      allCookies[c.name] = c.value;
      if (c.name === "sesnonce") sesnonce = c.value;
    }

    if (!sesnonce) {
      throw new Error("Failed to capture sesnonce cookie after login.");
    }
    console.log(`[cronometer] sesnonce captured: ${sesnonce.slice(0, 8)}...`);

    // If GWT values weren't captured from intercepted requests, use known defaults
    if (!gwtPermutation) {
      console.log("[cronometer] GWT values not intercepted, using known defaults...");
      gwtPermutation = "7B121DC5483BF272B1BC1916DA9FA963";
      gwtModuleBase = "https://cronometer.com/cronometer/";
    }
    if (!gwtHeader) {
      gwtHeader = "2D6A926E3729946302DC68073CB0D550";
    }

    await browser.close();

    // Now do GWT authenticate + generateAuthToken via direct HTTP
    const cookieHeader = Object.entries(allCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const gwtHeaders = {
      "Content-Type": gwtContentType,
      "X-GWT-Module-Base": gwtModuleBase,
      "X-GWT-Permutation": gwtPermutation,
      Cookie: cookieHeader,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };

    // GWT authenticate — returns user ID
    const authBody = `7|0|5|${gwtModuleBase}|${gwtHeader}|com.cronometer.client.CronometerService|authenticate|java.lang.Integer/3438268394|1|2|3|4|1|5|5|-300|`;

    const authResp = await fetch("https://cronometer.com/cronometer/app", {
      method: "POST",
      headers: gwtHeaders,
      body: authBody,
    });
    const authText = await authResp.text();
    console.log(`[cronometer] GWT authenticate response: ${authText.slice(0, 100)}`);

    // Extract user ID from response: //OK[userId,...]
    const userIdMatch = authText.match(/OK\[(\d+),/);
    const userId = userIdMatch?.[1] ?? "";

    if (!userId) {
      // Authentication may have updated the sesnonce cookie
      console.log("[cronometer] Could not extract user ID from GWT auth response, continuing...");
    }

    // Extract updated sesnonce from auth response cookies if present
    const authSetCookie = authResp.headers.get("set-cookie");
    if (authSetCookie) {
      const nMatch = authSetCookie.match(/sesnonce=([^;]+)/);
      if (nMatch) {
        sesnonce = nMatch[1];
        allCookies["sesnonce"] = sesnonce;
      }
    }

    // GWT generateAuthToken — returns the nonce for the export API
    const genTokenBody = `7|0|7|${gwtModuleBase}|${gwtHeader}|com.cronometer.client.CronometerService|generateAuthToken|java.lang.String/2004016611|I|${sesnonce}|1|2|3|4|2|5|6|7|${userId}|`;

    const tokenResp = await fetch("https://cronometer.com/cronometer/app", {
      method: "POST",
      headers: {
        ...gwtHeaders,
        Cookie: Object.entries(allCookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
      body: genTokenBody,
    });
    const tokenText = await tokenResp.text();
    console.log(`[cronometer] GWT generateAuthToken response: ${tokenText.slice(0, 100)}`);

    // Extract auth token: //OK["TOKEN"]
    const tokenMatch = tokenText.match(/"([^"]+)"/);
    const authToken = tokenMatch?.[1] ?? "";

    if (!authToken) {
      console.log("[cronometer] Warning: could not extract auth token. Export tools may not work.");
    }

    return {
      sesnonce,
      user_id: userId,
      auth_token: authToken,
      gwt_permutation: gwtPermutation,
      gwt_header: gwtHeader,
      gwt_content_type: gwtContentType,
      gwt_module_base: gwtModuleBase,
      all_cookies: allCookies,
      authenticated_at: Date.now(),
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
