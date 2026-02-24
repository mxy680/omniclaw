import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { CanvasClientManager, CanvasSession } from "../auth/canvas-client-manager.js";
import { generateDuoPasscode } from "../auth/duo-totp.js";
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
export function createCanvasAuthTool(
  canvasManager: CanvasClientManager,
  config: PluginConfig,
): any {
  return {
    name: "canvas_auth_setup",
    label: "Canvas Auth Setup",
    description:
      "Authenticate with Canvas LMS. Opens a browser, fills SSO credentials, waits for Duo/MFA, then captures session cookies. The tool automatically reads canvas_base_url, canvas_username, and canvas_password from the plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      base_url: Type.Optional(
        Type.String({
          description:
            "Override for the Canvas instance URL. Usually omitted — uses pre-configured value.",
        }),
      ),
      username: Type.Optional(
        Type.String({
          description: "Override for SSO username. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for SSO password. Usually omitted — uses pre-configured value.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'school'). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { base_url?: string; username?: string; password?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const rawBaseUrl = params.base_url ?? config.canvas_base_url;
      const resolvedUsername = params.username ?? config.canvas_username;
      const resolvedPassword = params.password ?? config.canvas_password;

      if (!rawBaseUrl || !resolvedUsername || !resolvedPassword) {
        const missing: string[] = [];
        if (!rawBaseUrl) missing.push("base_url");
        if (!resolvedUsername) missing.push("username");
        if (!resolvedPassword) missing.push("password");
        return jsonResult({
          status: "error",
          error: `Missing required parameter(s): ${missing.join(", ")}. Either pass them as tool arguments or pre-configure via: openclaw config set plugins.entries.omniclaw.config.canvas_base_url / canvas_username / canvas_password`,
        });
      }

      const base_url = rawBaseUrl.replace(/\/$/, "");

      const autoMfa = config.canvas_auto_mfa !== false && !!config.duo_totp_secret;

      try {
        const session = await runLoginFlow(
          base_url,
          resolvedUsername,
          resolvedPassword,
          autoMfa,
          config.duo_totp_secret,
        );
        canvasManager.setCredentials(account, session);

        // Fetch profile to confirm auth and return user info
        try {
          const profile = (await canvasManager.get(account, "users/self/profile")) as {
            name?: string;
            login_id?: string;
          };
          return jsonResult({
            status: "authenticated",
            account,
            name: profile.name ?? "unknown",
            login_id: profile.login_id ?? "unknown",
          });
        } catch {
          // Session saved but profile fetch failed — still return success
          return jsonResult({
            status: "authenticated",
            account,
            name: "unknown",
            login_id: "unknown",
            note: "Session saved but profile fetch failed. Tools may still work.",
          });
        }
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. Do NOT assume the cause — it could be wrong credentials, SSO form changes, MFA timeout, network issues, etc. If the user needs to update credentials, direct them to run: openclaw config set plugins.entries.omniclaw.config.canvas_password "new_password" — never ask them to type passwords in the chat.',
        });
      }
    },
  };
}

async function runLoginFlow(
  base_url: string,
  username: string,
  password: string,
  autoMfa: boolean = true,
  duoTotpSecret?: string,
): Promise<CanvasSession> {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("[canvas] Navigating to Canvas...");
    await page.goto(base_url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    // Fill SSO login form
    console.log("[canvas] Filling SSO credentials...");
    try {
      await page.waitForSelector('input[name="username"], input#username', { timeout: 15000 });
      await page.fill('input[name="username"], input#username', username);
      await page.fill('input[name="password"], input#password', password);

      // Click the login/submit button — broad selectors for CAS, SAML, standard Canvas
      const submit = page.locator(
        'button[type="submit"], input[type="submit"], ' +
          'button[name="submit"], input[name="submit"], ' +
          'button:has-text("Login"), button:has-text("Log In"), ' +
          'button:has-text("Sign In"), a:has-text("Login"), ' +
          'input[value="Login"], input[value="LOG IN"], ' +
          ".btn-submit, #submit, .login-btn",
      );
      await submit.first().click();
      console.log("[canvas] Credentials submitted, waiting for Duo MFA...");
    } catch (e) {
      console.log(`[canvas] SSO form not found or error: ${e}`);
      console.log(`[canvas] Current URL: ${page.url()}`);
    }

    // Attempt automated Duo MFA via TOTP
    // Supports both Duo Universal Prompt (full-page) and legacy iframe prompt
    let duoHandled = false;
    if (autoMfa && duoTotpSecret) {
      try {
        console.log("[canvas] Waiting for Duo prompt to appear...");

        // Use waitForURL to properly handle page navigations through SSO redirects
        let isUniversalPrompt = false;
        let isLegacyIframe = false;

        try {
          await page.waitForURL(/duosecurity\.com|duo\.com/, { timeout: 20000 });
          isUniversalPrompt = true;
          console.log(`[canvas] Duo Universal Prompt detected. URL: ${page.url()}`);
          await page.waitForLoadState("domcontentloaded");
        } catch {
          // Didn't redirect to Duo — check for legacy iframe
          console.log(`[canvas] No Duo redirect detected. URL: ${page.url()}`);
          const duoIframe = page.locator(
            'iframe#duo_iframe, iframe[src*="duosecurity"], iframe[src*="duo.com"]',
          );
          isLegacyIframe = await duoIframe
            .first()
            .isVisible({ timeout: 5000 })
            .catch(() => false);
        }

        if (isUniversalPrompt) {
          // --- Duo Universal Prompt (full-page redirect) ---
          console.log("[canvas] Handling Duo Universal Prompt...");

          // The Universal Prompt auto-sends a push. Click "Other options" to get to passcode entry.
          const otherOptions = page.locator(
            'a:has-text("Other options"), ' + 'button:has-text("Other options")',
          );
          await otherOptions.first().waitFor({ state: "visible", timeout: 10000 });
          await otherOptions.first().click();
          console.log("[canvas] Clicked 'Other options'.");

          // Select "Duo Mobile passcode" option
          const passcodeOption = page.locator(
            'a:has-text("Duo Mobile passcode"), ' +
              'a:has-text("Enter a Passcode"), ' +
              'a:has-text("Passcode"), ' +
              'button:has-text("Duo Mobile passcode"), ' +
              'button:has-text("Enter a Passcode"), ' +
              'button:has-text("Passcode")',
          );
          await passcodeOption.first().waitFor({ state: "visible", timeout: 5000 });
          await passcodeOption.first().click();
          console.log("[canvas] Selected passcode option.");

          // Wait for the passcode input to appear
          const passcodeInput = page.locator(
            'input[name="passcode-input"], ' + 'input[name="passcode"], ' + "input.passcode-input",
          );
          await passcodeInput.first().waitFor({ state: "visible", timeout: 5000 });

          // Generate and fill TOTP code
          const code = generateDuoPasscode(duoTotpSecret);
          console.log("[canvas] Generated Duo TOTP passcode.");
          await passcodeInput.first().fill(code);

          // Click verify/submit
          const verifyBtn = page.locator(
            'button:has-text("Verify"), button:has-text("Submit"), ' +
              'button:has-text("Log In"), button[type="submit"], ' +
              'input[type="submit"]',
          );
          await verifyBtn.first().click();
          console.log("[canvas] Duo passcode submitted.");
          duoHandled = true;
        } else if (isLegacyIframe) {
          // --- Legacy Duo iframe prompt ---
          console.log("[canvas] Detected legacy Duo iframe prompt.");
          const duoFrame = page.frameLocator(
            'iframe#duo_iframe, iframe[src*="duosecurity"], iframe[src*="duo.com"]',
          );

          const passcodeBtn = duoFrame.locator(
            'button:has-text("Enter a Passcode"), ' +
              'button:has-text("Passcode"), ' +
              'a:has-text("Enter a Passcode"), ' +
              'a:has-text("Passcode")',
          );

          if (await passcodeBtn.first().isVisible({ timeout: 5000 })) {
            await passcodeBtn.first().click();
            console.log("[canvas] Clicked Duo 'Enter a Passcode' button.");

            const code = generateDuoPasscode(duoTotpSecret);
            console.log("[canvas] Generated Duo TOTP passcode.");

            const passcodeInput = duoFrame.locator(
              'input[name="passcode"], input.passcode-input, input[type="text"]',
            );
            await passcodeInput.first().fill(code);

            const verifyBtn = duoFrame.locator(
              'button:has-text("Verify"), button:has-text("Submit"), ' +
                'button:has-text("Log In"), button[type="submit"], ' +
                'input[type="submit"]',
            );
            await verifyBtn.first().click();
            console.log("[canvas] Duo passcode submitted.");
            duoHandled = true;
          } else {
            console.log("[canvas] Duo passcode button not found — falling back to manual MFA.");
          }
        } else {
          console.log("[canvas] Duo prompt not detected — falling back to manual MFA.");
        }
      } catch (e) {
        console.log(`[canvas] Auto-MFA error: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (duoHandled) {
      console.log("[canvas] Waiting for Duo verification to complete...");
    } else {
      console.log("[canvas] Waiting for manual MFA approval (up to 5 minutes)...");
    }

    // Poll for login completion (up to 5 minutes)
    let trustClicked = false;
    let loggedIn = false;

    const canvasHost = new URL(base_url).hostname;

    for (let i = 0; i < 300; i++) {
      const currentUrl = page.url();

      // Only check for canvas_session once we're back on the Canvas domain
      // (Canvas may set a pre-auth canvas_session cookie before the SSO redirect)
      const onCanvasDomain = currentUrl.includes(canvasHost);
      if (onCanvasDomain) {
        const cookies = await context.cookies();
        const canvasSessionCookie = cookies.find(
          (c) => c.name === "canvas_session" && c.domain.includes(canvasHost),
        );
        if (canvasSessionCookie) {
          console.log(`[canvas] Login complete! URL: ${currentUrl}`);
          loggedIn = true;
          break;
        }
      }

      // Auto-click trust device buttons (Duo)
      if (!trustClicked) {
        try {
          const trustBtn = page.locator(
            'button:has-text("Yes, this is my device"), ' +
              'button:has-text("Trust"), ' +
              'button:has-text("Yes"), ' +
              "button#trust-browser-button, " +
              'input[value="Yes, this is my device"]',
          );
          if (await trustBtn.first().isVisible({ timeout: 500 })) {
            await trustBtn.first().click();
            trustClicked = true;
            console.log("[canvas] Clicked 'Yes, this is my device'");
          }
        } catch {
          // Trust button not visible yet, continue polling
        }
      }

      if (i % 30 === 0 && i > 0) {
        console.log(`[canvas] Still waiting for MFA... (${i}s, URL: ${currentUrl.slice(0, 80)})`);
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error("Login timed out after 5 minutes waiting for Duo MFA.");
    }

    await page.waitForLoadState("load");

    // Extract CSRF token from Canvas HTML meta tag
    console.log("[canvas] Extracting CSRF token from Canvas HTML...");
    await page.goto(base_url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    const csrfMeta: string | null = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      return meta ? meta.getAttribute("content") : null;
    });

    if (csrfMeta) {
      console.log(`[canvas] CSRF meta token: ${csrfMeta.slice(0, 30)}...`);
    } else {
      console.log("[canvas] CSRF meta token: not found");
    }

    // Capture all cookies in their final state
    const finalCookies = await context.cookies();
    const allCookies: Record<string, string> = {};
    for (const c of finalCookies) {
      allCookies[c.name] = c.value;
    }

    await browser.close();

    return {
      base_url,
      canvas_session: allCookies["canvas_session"] ?? "",
      _csrf_token: allCookies["_csrf_token"] ?? "",
      log_session_id: allCookies["log_session_id"] ?? "",
      csrf_meta_token: csrfMeta ?? "",
      all_cookies: allCookies,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
