import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { SlackClientManager, SlackSession } from "../auth/slack-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";
import { generateDuoPasscode } from "../auth/duo-totp.js";
import { jsonResult } from "./slack-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSlackAuthTool(
  manager: SlackClientManager,
  config: PluginConfig,
): any {
  return {
    name: "slack_auth_setup",
    label: "Slack Auth Setup",
    description:
      "Authenticate with Slack by opening a browser for login. " +
      "If canvas_username, canvas_password, and duo_totp_secret are configured, login is fully automated. " +
      "Otherwise opens a browser for manual login. " +
      "The workspace can be provided as a parameter or pre-configured via slack_workspace in plugin config.",
    parameters: Type.Object({
      workspace: Type.Optional(
        Type.String({
          description:
            "Slack workspace subdomain (e.g. 'mycompany' for mycompany.slack.com). " +
            "If omitted, uses the pre-configured slack_workspace value.",
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
      params: { workspace?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const workspace = params.workspace ?? config.slack_workspace;

      if (!workspace) {
        return jsonResult({
          status: "error",
          error: "No Slack workspace specified.",
          hint:
            'Provide the workspace parameter (e.g. "mycompany" for mycompany.slack.com) or configure it via: ' +
            'openclaw config set plugins.entries.omniclaw.config.slack_workspace "mycompany"',
        });
      }

      // Check if we already have valid credentials
      if (manager.hasCredentials(account)) {
        try {
          const creds = manager.getCredentials(account)!;
          const resp = await fetch("https://slack.com/api/auth.test", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${creds.xoxc_token}`,
              Cookie: `d=${creds.d_cookie}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ token: creds.xoxc_token }).toString(),
          });
          const data = (await resp.json()) as { ok: boolean; team?: string; user?: string };
          if (data.ok) {
            return jsonResult({
              status: "already_authenticated",
              account,
              team_id: creds.team_id,
              team_name: creds.team_name,
              user_id: creds.user_id,
              workspace,
              message: "Existing session is still valid. No re-authentication needed.",
            });
          }
        } catch {
          // Validation failed — proceed with re-auth
        }
      }

      // Determine if we can auto-login
      const username = config.canvas_username;
      const password = config.canvas_password;
      const duoTotpSecret = config.duo_totp_secret;
      const autoLogin = !!username && !!password;
      const autoMfa = autoLogin && !!duoTotpSecret;

      try {
        const session = await runSlackLoginFlow(workspace, username, password, autoMfa, duoTotpSecret);

        manager.setCredentials(account, session);

        return jsonResult({
          status: "authenticated",
          account,
          team_id: session.team_id,
          team_name: session.team_name,
          user_id: session.user_id,
          workspace,
          auto_login: autoLogin,
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: autoLogin
            ? "Auto-login failed. Check canvas_username, canvas_password, and duo_totp_secret config values."
            : "Make sure you complete the Slack login flow in the browser window that opens.",
        });
      }
    },
  };
}

async function runSlackLoginFlow(
  workspace: string,
  username?: string,
  password?: string,
  autoMfa?: boolean,
  duoTotpSecret?: string,
): Promise<SlackSession> {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Intercept network responses to capture xoxc- token from boot data
  let interceptedToken = "";
  let interceptedTeamId = "";
  let interceptedTeamName = "";
  let interceptedUserId = "";

  page.on("response", async (response) => {
    if (interceptedToken) return;
    const url = response.url();
    if (
      url.includes("/api/client.boot") ||
      url.includes("/api/client.counts") ||
      url.includes("/api/conversations.list") ||
      url.includes("/ssb/redirect") ||
      url.includes("boot_data") ||
      (url.includes("slack.com") && url.includes("/api/"))
    ) {
      try {
        const ct = response.headers()["content-type"] ?? "";
        if (ct.includes("application/json") && response.status() === 200) {
          const text = await response.text();
          const tokenMatch = text.match(/xoxc-[a-zA-Z0-9-]+/);
          if (tokenMatch) {
            interceptedToken = tokenMatch[0];
            console.log(`[slack] Token intercepted from ${url.split("?")[0]}`);
            const teamMatch = text.match(/"team_id"\s*:\s*"(T[A-Z0-9]+)"/);
            if (teamMatch) interceptedTeamId = teamMatch[1];
            const nameMatch = text.match(/"team_name"\s*:\s*"([^"]+)"/);
            if (nameMatch) interceptedTeamName = nameMatch[1];
            const userMatch = text.match(/"user_id"\s*:\s*"(U[A-Z0-9]+)"/);
            if (userMatch) interceptedUserId = userMatch[1];
          }
        }
      } catch {
        // Response may not be readable
      }
    }
  });

  page.on("response", async (response) => {
    if (interceptedToken) return;
    const url = response.url();
    if (url.includes("slack.com") && !url.includes("/api/")) {
      try {
        const ct = response.headers()["content-type"] ?? "";
        if (ct.includes("text/html") && response.status() === 200) {
          const text = await response.text();
          const tokenMatch = text.match(/xoxc-[a-zA-Z0-9-]+/);
          if (tokenMatch) {
            interceptedToken = tokenMatch[0];
            console.log(`[slack] Token intercepted from HTML response: ${url.split("?")[0]}`);
            const teamMatch = text.match(/"team_id"\s*:\s*"(T[A-Z0-9]+)"/);
            if (teamMatch) interceptedTeamId = teamMatch[1];
            const nameMatch = text.match(/"team_name"\s*:\s*"([^"]+)"/);
            if (nameMatch) interceptedTeamName = nameMatch[1];
            const userMatch = text.match(/"user_id"\s*:\s*"(U[A-Z0-9]+)"/);
            if (userMatch) interceptedUserId = userMatch[1];
          }
        }
      } catch {
        // Response may not be readable
      }
    }
  });

  try {
    const slackUrl = `https://${workspace}.slack.com`;
    console.log(`[slack] Navigating to ${slackUrl}...`);

    await page.goto(slackUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // === Auto-login: click "Sign in with Google" and handle SSO ===
    if (username && password) {
      console.log("[slack] Auto-login enabled. Looking for Sign in with Google...");

      // Click "Sign in with Google" button on the Slack login page
      const googleBtn = page.locator(
        'a:has-text("Sign in with Google"), ' +
          'button:has-text("Sign in with Google"), ' +
          'a:has-text("Sign In With Google"), ' +
          'a[href*="google"], ' +
          '.sign_in_with_google, ' +
          '[data-qa="sign_in_with_google"]',
      );

      try {
        await googleBtn.first().waitFor({ state: "visible", timeout: 10000 });
        await googleBtn.first().click();
        console.log("[slack] Clicked Sign in with Google.");
      } catch {
        console.log("[slack] No Google sign-in button found. Trying direct SSO...");
      }

      // Wait for login form to appear (works regardless of SAML/CAS redirect URL)
      try {
        await page.waitForSelector('input[name="username"], input#username', { timeout: 20000 });
        console.log(`[slack] SSO login form found at: ${page.url()}`);
      } catch {
        console.log("[slack] No SSO login form detected. May already be logged in.");
      }

      // Fill SSO credentials
      const currentUrl = page.url();

      if (currentUrl.includes("login.case.edu") || currentUrl.includes("cas/login") || currentUrl.includes("idp/profile")) {
        // CWRU SSO (CAS) — fields: input#username, input#password, submit is input[type="image"]#login-submit
        console.log("[slack] Filling CWRU SSO credentials...");
        await page.fill('input#username', username);
        await page.fill('input#password', password);

        const submit = page.locator(
          '#login-submit, input[type="image"], ' +
            'button[type="submit"], input[type="submit"], ' +
            'button:has-text("LOGIN"), button:has-text("Login"), ' +
            'input[value="Login"], input[value="LOGIN"]',
        );
        await submit.first().click();
        console.log("[slack] SSO credentials submitted.");

        // Handle Duo MFA
        if (autoMfa && duoTotpSecret) {
          console.log("[slack] Handling Duo MFA...");
          let duoHandled = false;

          // Try Universal Prompt (full-page redirect to duosecurity.com)
          try {
            await page.waitForURL(/duosecurity\.com|duo\.com/, { timeout: 20000 });
            console.log("[slack] Duo Universal Prompt detected.");

            // Click "Other options" to get to passcode entry
            const otherOptions = page.locator(
              'a:has-text("Other options"), button:has-text("Other options")',
            );
            await otherOptions.first().waitFor({ state: "visible", timeout: 10000 });
            await otherOptions.first().click();

            // Select "Duo Mobile passcode"
            const passcodeOption = page.locator(
              'a:has-text("Duo Mobile passcode"), ' +
                'a:has-text("Enter a Passcode"), ' +
                'a:has-text("Passcode"), ' +
                'button:has-text("Duo Mobile passcode"), ' +
                'button:has-text("Enter a Passcode"), ' +
                'button:has-text("Passcode")',
            );
            await passcodeOption.first().waitFor({ state: "visible", timeout: 10000 });
            await passcodeOption.first().click();

            // Fill TOTP code
            const passcodeInput = page.locator(
              'input[name="passcode-input"], input[name="passcode"], input.passcode-input',
            );
            await passcodeInput.first().waitFor({ state: "visible", timeout: 10000 });
            const code = generateDuoPasscode(duoTotpSecret);
            console.log("[slack] Generated Duo TOTP code.");
            await passcodeInput.first().fill(code);

            // Click Verify
            const verifyBtn = page.locator(
              'button:has-text("Verify"), button:has-text("Submit"), ' +
                'button:has-text("Log In"), button[type="submit"], input[type="submit"]',
            );
            await verifyBtn.first().click();
            console.log("[slack] Duo code submitted.");

            // Click "Yes, this is my device" if it appears
            try {
              const trustBtn = page.locator(
                'button:has-text("Yes, this is my device"), ' +
                  'button:has-text("Yes, trust"), ' +
                  'button:has-text("Trust this browser"), ' +
                  '#trust-browser-button',
              );
              await trustBtn.first().waitFor({ state: "visible", timeout: 5000 });
              await trustBtn.first().click();
              console.log("[slack] Clicked trust device button.");
            } catch {
              // Trust prompt may not appear
            }

            duoHandled = true;
          } catch {
            console.log("[slack] No Duo Universal Prompt redirect. Checking for iframe...");
          }

          // Try Legacy Duo Iframe
          if (!duoHandled) {
            try {
              const duoIframe = page.locator(
                'iframe#duo_iframe, iframe[src*="duosecurity"], iframe[src*="duo.com"]',
              );
              const hasIframe = await duoIframe.first().isVisible({ timeout: 5000 }).catch(() => false);

              if (hasIframe) {
                console.log("[slack] Duo iframe detected.");
                const duoFrame = page.frameLocator(
                  'iframe#duo_iframe, iframe[src*="duosecurity"], iframe[src*="duo.com"]',
                );

                const passcodeBtn = duoFrame.locator(
                  'button:has-text("Enter a Passcode"), ' +
                    'button:has-text("Passcode"), ' +
                    'a:has-text("Enter a Passcode"), ' +
                    'a:has-text("Passcode")',
                );
                await passcodeBtn.first().click();

                const code = generateDuoPasscode(duoTotpSecret);
                console.log("[slack] Generated Duo TOTP code (iframe).");

                const passcodeInput = duoFrame.locator(
                  'input[name="passcode"], input.passcode-input, input[type="text"]',
                );
                await passcodeInput.first().fill(code);

                const verifyBtn = duoFrame.locator(
                  'button:has-text("Verify"), button:has-text("Submit"), ' +
                    'button:has-text("Log In"), button[type="submit"], input[type="submit"]',
                );
                await verifyBtn.first().click();
                console.log("[slack] Duo code submitted (iframe).");
              }
            } catch {
              console.log("[slack] No Duo iframe found.");
            }
          }
        }

        // Handle Google account picker ("Continue as..." or account selection)
        try {
          await page.waitForURL(/accounts\.google\.com/, { timeout: 10000 });
          console.log("[slack] Google account picker detected.");

          const continueBtn = page.locator(
            'button:has-text("Continue"), ' +
              'div[data-identifier], ' +
              'li[data-identifier]',
          );
          await continueBtn.first().waitFor({ state: "visible", timeout: 5000 });
          await continueBtn.first().click();
          console.log("[slack] Clicked Continue on Google account picker.");
        } catch {
          // Google picker may not appear
        }
      }
    } else {
      console.log("[slack] No credentials configured. Waiting for manual login...");
    }

    // Wait for the `d` cookie (set after successful auth)
    console.log("[slack] Waiting for Slack session cookie...");

    let dCookie = "";
    for (let i = 0; i < 300; i++) {
      const cookies = await context.cookies();
      const dCookieObj = cookies.find((c) => c.name === "d" && c.value.startsWith("xoxd-"));
      if (dCookieObj) {
        dCookie = dCookieObj.value;
        break;
      }

      const currentUrl = page.url();
      if (currentUrl.includes("/client/") || currentUrl.includes("/messages/") || currentUrl.includes("app.slack.com")) {
        const postRedirectCookies = await context.cookies();
        const found = postRedirectCookies.find((c) => c.name === "d" && c.value.startsWith("xoxd-"));
        if (found) {
          dCookie = found.value;
          break;
        }
      }

      if (i % 30 === 0 && i > 0) {
        console.log(`[slack] Still waiting for login... (${i}s)`);
      }

      await page.waitForTimeout(1000);
    }

    if (!dCookie) {
      throw new Error("Login timed out after 5 minutes. No session cookie (d=xoxd-...) was captured.");
    }

    console.log("[slack] Session cookie captured. Extracting xoxc- token...");

    // If interceptor already caught it, we're done
    let xoxcToken = interceptedToken;
    let teamId = interceptedTeamId;
    let teamName = interceptedTeamName;
    let userId = interceptedUserId;

    // Wait for client app to load and fire API calls
    if (!xoxcToken) {
      console.log("[slack] Waiting for client app to load...");
      for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(1000);
        if (interceptedToken) {
          xoxcToken = interceptedToken;
          teamId = interceptedTeamId;
          teamName = interceptedTeamName;
          userId = interceptedUserId;
          break;
        }
      }
    }

    // Try localStorage — Slack stores token in localConfig_v2
    if (!xoxcToken) {
      console.log("[slack] Trying localStorage...");
      try {
        const localData = await page.evaluate(() => {
          const result: Record<string, string> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              const val = localStorage.getItem(key);
              if (val) result[key] = val;
            }
          }
          return result;
        });

        for (const [key, value] of Object.entries(localData)) {
          if (value.includes("xoxc-")) {
            console.log(`[slack] Found xoxc- in localStorage key: ${key}`);
            try {
              const parsed = JSON.parse(value);
              if (parsed.teams) {
                for (const [tid, teamData] of Object.entries(parsed.teams) as [string, Record<string, unknown>][]) {
                  if (typeof teamData.token === "string" && (teamData.token as string).startsWith("xoxc-")) {
                    xoxcToken = teamData.token as string;
                    teamId = tid;
                    teamName = (teamData.name as string) ?? "";
                    userId = (teamData.user_id as string) ?? "";
                    break;
                  }
                }
              }
              if (!xoxcToken && typeof parsed.token === "string" && parsed.token.startsWith("xoxc-")) {
                xoxcToken = parsed.token;
              }
              if (!xoxcToken && typeof parsed.api_token === "string" && parsed.api_token.startsWith("xoxc-")) {
                xoxcToken = parsed.api_token;
              }
            } catch {
              const match = value.match(/xoxc-[a-zA-Z0-9-]+/);
              if (match) xoxcToken = match[0];
            }
            if (xoxcToken) break;
          }
        }
      } catch (e) {
        console.log(`[slack] localStorage access failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    // Try window globals (boot_data, etc.)
    if (!xoxcToken) {
      console.log("[slack] Trying window globals...");
      try {
        const bootData = await page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = window as any;
          const candidates = [
            w.boot_data,
            w.TS?.boot_data,
            w.TS?.model?.boot_data,
            w.slackConfig,
          ].filter(Boolean);

          for (const candidate of candidates) {
            if (candidate?.api_token) {
              return {
                token: candidate.api_token,
                team_id: candidate.team_id,
                team_name: candidate.team_name ?? candidate.team_domain,
                user_id: candidate.user_id,
              };
            }
          }

          const windowKeys = Object.keys(w);
          for (const key of windowKeys) {
            try {
              const val = w[key];
              if (typeof val === "string" && val.startsWith("xoxc-")) {
                return { token: val, team_id: "", team_name: "", user_id: "" };
              }
              if (val && typeof val === "object" && val.api_token?.startsWith("xoxc-")) {
                return {
                  token: val.api_token,
                  team_id: val.team_id ?? "",
                  team_name: val.team_name ?? "",
                  user_id: val.user_id ?? "",
                };
              }
            } catch {
              // Skip inaccessible properties
            }
          }

          return null;
        });

        if (bootData?.token?.startsWith("xoxc-")) {
          xoxcToken = bootData.token;
          teamId = bootData.team_id ?? "";
          teamName = bootData.team_name ?? "";
          userId = bootData.user_id ?? "";
        }
      } catch (e) {
        console.log(`[slack] Window globals access failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    // Parse page HTML for inline xoxc- token
    if (!xoxcToken) {
      console.log("[slack] Trying page HTML extraction...");
      try {
        const pageContent = await page.content();
        const patterns = [
          /"api_token"\s*:\s*"(xoxc-[a-zA-Z0-9-]+)"/,
          /"token"\s*:\s*"(xoxc-[a-zA-Z0-9-]+)"/,
          /xoxc-[a-zA-Z0-9-]+/,
        ];
        for (const pattern of patterns) {
          const match = pageContent.match(pattern);
          if (match) {
            xoxcToken = match[1] ?? match[0];
            console.log("[slack] Token found in page HTML.");
            break;
          }
        }
        if (!teamId) {
          const teamMatch = pageContent.match(/"team_id"\s*:\s*"(T[A-Z0-9]+)"/);
          if (teamMatch) teamId = teamMatch[1];
        }
        if (!userId) {
          const userMatch = pageContent.match(/"user_id"\s*:\s*"(U[A-Z0-9]+)"/);
          if (userMatch) userId = userMatch[1];
        }
      } catch (e) {
        console.log(`[slack] Page HTML extraction failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    // Fallback: navigate to emoji customization page
    if (!xoxcToken) {
      console.log("[slack] Trying /customize/emoji endpoint for token extraction...");
      try {
        await page.goto(`https://${workspace}.slack.com/customize/emoji`, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        await page.waitForTimeout(2000);
        const emojiPage = await page.content();
        const match = emojiPage.match(/api_token['"]\s*:\s*['"](xoxc-[a-zA-Z0-9-]+)['"]/);
        if (match) {
          xoxcToken = match[1];
        } else {
          const broadMatch = emojiPage.match(/xoxc-[a-zA-Z0-9-]+/);
          if (broadMatch) xoxcToken = broadMatch[0];
        }
        if (!teamId) {
          const teamMatch = emojiPage.match(/"team_id"\s*:\s*"(T[A-Z0-9]+)"/);
          if (teamMatch) teamId = teamMatch[1];
        }
        if (!userId) {
          const userMatch = emojiPage.match(/"user_id"\s*:\s*"(U[A-Z0-9]+)"/);
          if (userMatch) userId = userMatch[1];
        }
      } catch (e) {
        console.log(`[slack] Emoji page extraction failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (!xoxcToken) {
      throw new Error(
        "Could not extract xoxc- token from Slack. " +
          "The login succeeded (session cookie was captured) but the API token was not found. " +
          "Make sure the Slack web client fully loaded after login.",
      );
    }

    // Capture all cookies
    const finalCookies = await context.cookies();
    const allCookies: Record<string, string> = {};
    for (const c of finalCookies) {
      allCookies[c.name] = c.value;
    }

    await browser.close();

    const session: SlackSession = {
      xoxc_token: xoxcToken,
      d_cookie: dCookie,
      team_id: teamId,
      team_name: teamName || workspace,
      user_id: userId,
      all_cookies: allCookies,
    };

    // Validate with auth.test
    const validateResp = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xoxcToken}`,
        Cookie: `d=${dCookie}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token: xoxcToken }).toString(),
    });

    const validateData = (await validateResp.json()) as {
      ok: boolean;
      error?: string;
      team_id?: string;
      team?: string;
      user_id?: string;
      user?: string;
    };

    if (!validateData.ok) {
      throw new Error(`Token validation failed: ${validateData.error}`);
    }

    session.team_id = session.team_id || validateData.team_id || "";
    session.team_name = session.team_name || validateData.team || workspace;
    session.user_id = session.user_id || validateData.user_id || "";

    return session;
  } catch (err) {
    await browser.close();
    throw err;
  }
}
