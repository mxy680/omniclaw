// src/tools/hcm-auth-tool.ts
import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { HcmClientManager, HcmSession } from "../auth/hcm-client-manager.js";
import { HCM_BASE_URL } from "../auth/hcm-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";
import { generateDuoPasscode } from "../auth/duo-totp.js";
import { jsonResult } from "./hcm-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmAuthTool(
  manager: HcmClientManager,
  config: PluginConfig,
): any {
  return {
    name: "hcm_auth_setup",
    label: "HCM Auth Setup",
    description:
      "Authenticate with CWRU PeopleSoft HCM (hcm.case.edu) via browser login. " +
      "If hcm_case_id, hcm_password, and duo_totp_secret are configured, login is fully automated. " +
      "Otherwise opens a browser for manual login.",
    parameters: Type.Object({
      case_id: Type.Optional(
        Type.String({ description: "CWRU Case ID (e.g. 'abc123'). Overrides hcm_case_id config." }),
      ),
      password: Type.Optional(
        Type.String({ description: "CWRU password. Overrides hcm_password config." }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { case_id?: string; password?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const caseId = params.case_id ?? config.hcm_case_id;
      const password = params.password ?? config.hcm_password;
      const duoTotpSecret = config.duo_totp_secret;
      const autoLogin = !!caseId && !!password;
      const autoMfa = autoLogin && !!duoTotpSecret;

      // Check if already authenticated
      if (manager.hasCredentials(account)) {
        try {
          const valid = await validateHcmSession(manager, account);
          if (valid) {
            const session = manager.getCredentials(account)!;
            return jsonResult({
              status: "already_authenticated",
              account,
              employee_name: session.employee_name,
            });
          }
        } catch {
          // Session invalid — proceed with re-auth
        }
      }

      try {
        const session = await runHcmLoginFlow(caseId, password, autoMfa, duoTotpSecret);
        manager.setCredentials(account, session);
        return jsonResult({
          status: "authenticated",
          account,
          employee_name: session.employee_name,
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: autoLogin
            ? "Auto-login failed. Check hcm_case_id, hcm_password, and duo_totp_secret in plugin config."
            : 'Configure credentials: openclaw config set plugins.entries.omniclaw.config.hcm_case_id "abc123"',
        });
      }
    },
  };
}

async function validateHcmSession(manager: HcmClientManager, account: string): Promise<boolean> {
  const session = manager.getCredentials(account);
  if (!session) return false;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(
    session.cookie_details.map((c) => ({
      ...c,
      sameSite: "Lax" as const,
    })),
  );

  const page = await context.newPage();
  try {
    await page.goto(HCM_BASE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
    const url = page.url();
    const valid = !url.includes("login.case.edu") && !url.includes("cas/login");
    await browser.close();
    return valid;
  } catch {
    await browser.close();
    return false;
  }
}

async function runHcmLoginFlow(
  caseId?: string,
  password?: string,
  autoMfa?: boolean,
  duoTotpSecret?: string,
): Promise<HcmSession> {
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

  try {
    console.log("[hcm] Navigating to hcm.case.edu...");
    await page.goto(HCM_BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    if (caseId && password) {
      console.log("[hcm] Auto-login enabled. Waiting for CAS login form...");

      try {
        await page.waitForSelector('input#username, input[name="username"]', { timeout: 20000 });
        console.log(`[hcm] CAS login form found at: ${page.url()}`);

        await page.fill('input#username, input[name="username"]', caseId);
        await page.fill('input#password, input[name="password"]', password);

        const submitBtn = page.locator(
          '#login-submit, input[type="image"], button[type="submit"], input[type="submit"]',
        );
        await submitBtn.first().click();
        console.log("[hcm] CAS credentials submitted.");
      } catch {
        console.log("[hcm] No CAS login form found — may already be logged in.");
      }

      // Handle Duo MFA
      if (autoMfa && duoTotpSecret) {
        console.log("[hcm] Handling Duo MFA...");
        let duoHandled = false;

        // Try Universal Prompt (full-page redirect)
        try {
          await page.waitForURL(/duosecurity\.com|duo\.com/, { timeout: 20000 });
          console.log("[hcm] Duo Universal Prompt detected.");

          const otherOptions = page.locator(
            'a:has-text("Other options"), button:has-text("Other options")',
          );
          await otherOptions.first().waitFor({ state: "visible", timeout: 10000 });
          await otherOptions.first().click();

          const passcodeOption = page.locator(
            'a:has-text("Duo Mobile passcode"), a:has-text("Enter a Passcode"), ' +
            'button:has-text("Duo Mobile passcode"), button:has-text("Enter a Passcode")',
          );
          await passcodeOption.first().waitFor({ state: "visible", timeout: 10000 });
          await passcodeOption.first().click();

          const passcodeInput = page.locator(
            'input[name="passcode-input"], input[name="passcode"], input.passcode-input',
          );
          await passcodeInput.first().waitFor({ state: "visible", timeout: 10000 });
          const code = generateDuoPasscode(duoTotpSecret);
          console.log("[hcm] Generated Duo TOTP code.");
          await passcodeInput.first().fill(code);

          const verifyBtn = page.locator(
            'button:has-text("Verify"), button:has-text("Submit"), button:has-text("Log In")',
          );
          await verifyBtn.first().click();
          console.log("[hcm] Duo code submitted.");

          try {
            const trustBtn = page.locator(
              'button:has-text("Yes, this is my device"), button:has-text("Trust")',
            );
            await trustBtn.first().waitFor({ state: "visible", timeout: 5000 });
            await trustBtn.first().click();
            console.log("[hcm] Clicked trust device button.");
          } catch { /* Trust prompt may not appear */ }

          duoHandled = true;
        } catch {
          console.log("[hcm] No Duo Universal Prompt. Checking for iframe...");
        }

        // Try Legacy Duo Iframe
        if (!duoHandled) {
          try {
            const duoIframe = page.locator(
              'iframe#duo_iframe, iframe[src*="duosecurity"], iframe[src*="duo.com"]',
            );
            const hasIframe = await duoIframe.first().isVisible({ timeout: 5000 }).catch(() => false);

            if (hasIframe) {
              console.log("[hcm] Duo iframe detected.");
              const duoFrame = page.frameLocator(
                'iframe#duo_iframe, iframe[src*="duosecurity"], iframe[src*="duo.com"]',
              );

              const passcodeBtn = duoFrame.locator(
                'button:has-text("Enter a Passcode"), a:has-text("Enter a Passcode")',
              );
              await passcodeBtn.first().click();

              const code = generateDuoPasscode(duoTotpSecret);
              console.log("[hcm] Generated Duo TOTP code (iframe).");

              const passcodeInput = duoFrame.locator(
                'input[name="passcode"], input.passcode-input, input[type="text"]',
              );
              await passcodeInput.first().fill(code);

              const verifyBtn = duoFrame.locator(
                'button:has-text("Verify"), button:has-text("Submit"), button:has-text("Log In")',
              );
              await verifyBtn.first().click();
              console.log("[hcm] Duo code submitted (iframe).");
            }
          } catch {
            console.log("[hcm] No Duo iframe found.");
          }
        }
      } else if (caseId && password) {
        console.log("[hcm] Waiting for manual Duo approval (push notification)...");
      }
    } else {
      console.log("[hcm] No credentials configured. Waiting for manual login...");
    }

    // Wait for PeopleSoft to load
    console.log("[hcm] Waiting for PeopleSoft session...");

    let loggedIn = false;
    for (let i = 0; i < 300; i++) {
      const currentUrl = page.url();
      if (
        currentUrl.includes("hcm.case.edu") &&
        !currentUrl.includes("login.case.edu") &&
        !currentUrl.includes("cas/login") &&
        !currentUrl.includes("duosecurity.com") &&
        !currentUrl.includes("duo.com")
      ) {
        const cookies = await context.cookies();
        const psToken = cookies.find((c) => c.name === "PS_TOKEN" || c.name === "PS_TOKEN_2");
        if (psToken) {
          loggedIn = true;
          break;
        }
        if (cookies.some((c) => c.domain.includes("case.edu") && c.name.includes("SESSION"))) {
          loggedIn = true;
          break;
        }
        const hasPS = await page.locator("#pthdr2container, .ps_header, #PT_WORK").isVisible().catch(() => false);
        if (hasPS) {
          loggedIn = true;
          break;
        }
      }

      if (i % 30 === 0 && i > 0) {
        console.log(`[hcm] Still waiting for login... (${i}s)`);
      }
      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error("Login timed out after 5 minutes. PeopleSoft session was not established.");
    }

    console.log("[hcm] PeopleSoft session established. Extracting cookies...");

    let employeeName = "unknown";
    try {
      employeeName = await page.evaluate(() => {
        const nameEl = document.querySelector(
          '#pthdr2usrname, .ps-username, [id*="EMPLOYEE_NAME"], [id*="PERSON_NAME"]',
        );
        if (nameEl?.textContent?.trim()) return nameEl.textContent.trim();
        const welcome = document.body.innerText.match(/Welcome[,\s]+([A-Za-z\s]+)/i);
        if (welcome) return welcome[1].trim();
        return "unknown";
      }) || "unknown";
      console.log(`[hcm] Employee name: ${employeeName}`);
    } catch { /* best-effort */ }

    const finalCookies = await context.cookies();
    const allCookies: Record<string, string> = {};
    const cookieDetails: Array<{ name: string; value: string; domain: string; path: string }> = [];
    for (const c of finalCookies) {
      allCookies[c.name] = c.value;
      cookieDetails.push({ name: c.name, value: c.value, domain: c.domain, path: c.path });
    }

    await browser.close();
    return { cookies: allCookies, cookie_details: cookieDetails, employee_name: employeeName };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
