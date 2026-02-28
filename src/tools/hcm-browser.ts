// src/tools/hcm-browser.ts
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { HcmClientManager } from "../auth/hcm-client-manager.js";
import { HCM_BASE_URL } from "../auth/hcm-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";
import { generateDuoPasscode } from "../auth/duo-totp.js";

export interface HcmBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export interface HcmLoginConfig {
  caseId?: string;
  password?: string;
  duoTotpSecret?: string;
}

export function resolveLoginConfig(config: PluginConfig): HcmLoginConfig {
  return {
    caseId: config.hcm_case_id ?? config.canvas_username,
    password: config.hcm_password ?? config.canvas_password,
    duoTotpSecret: config.duo_totp_secret,
  };
}

/**
 * Launches a headless Playwright browser for HCM.
 * Restores stored cookies. If CAS redirect is detected and credentials
 * are available, performs auto-login (CAS + Duo MFA).
 */
export async function launchHcmBrowser(
  manager: HcmClientManager,
  account: string,
  loginConfig?: HcmLoginConfig,
): Promise<HcmBrowserSession> {
  const session = manager.getCredentials(account);
  if (!session && !(loginConfig?.caseId && loginConfig?.password)) {
    throw new Error("No credentials for account: " + account);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  // Restore stored cookies if available
  if (session?.cookie_details?.length) {
    await context.addCookies(
      session.cookie_details.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly ?? false,
        secure: c.secure ?? false,
        sameSite: (c.sameSite as "Strict" | "Lax" | "None") ?? "Lax",
        expires: c.expires ?? -1,
      })),
    );
  }

  const page = await context.newPage();
  await page.goto(HCM_BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log(`[hcm] Browser landed on: ${url}`);

  if (url.includes("login.case.edu") || url.includes("cas/login")) {
    if (loginConfig?.caseId && loginConfig?.password) {
      console.log("[hcm] CAS redirect detected — performing auto-login...");
      await performCasLogin(page, context, loginConfig);
      await updateStoredCookies(manager, account, context, page);
      return { browser, context, page };
    }
    await browser.close();
    throw new Error("HCM session expired");
  }

  return { browser, context, page };
}

/**
 * Performs CAS login + Duo MFA on a page showing a CAS login form.
 * After success, page will be on hcm.case.edu with a valid PeopleSoft session.
 */
export async function performCasLogin(
  page: Page,
  context: BrowserContext,
  config: HcmLoginConfig,
): Promise<void> {
  const { caseId, password, duoTotpSecret } = config;

  // Fill CAS login form
  try {
    await page.waitForSelector('input#username, input[name="username"]', { timeout: 10000 });
    console.log(`[hcm] CAS login form at: ${page.url()}`);

    await page.fill('input#username, input[name="username"]', caseId!);
    await page.fill('input#password, input[name="password"]', password!);

    const submitBtn = page.locator(
      '#login-submit, input[type="image"], button[type="submit"], input[type="submit"]',
    );
    await submitBtn.first().click();
    console.log("[hcm] CAS credentials submitted.");
  } catch {
    console.log("[hcm] No CAS login form found — may be past login.");
  }

  // Handle Duo MFA
  let duoHandled = false;
  try {
    await page.waitForURL(/duosecurity\.com|duo\.com/, { timeout: 20000 });
    console.log("[hcm] Duo Universal Prompt detected.");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Click "Other options" to see available auth methods
    try {
      await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll("a.button--link")).find(
          (a) => a.textContent?.trim() === "Other options",
        ) as HTMLElement | undefined;
        if (el) el.click();
      });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log(`[hcm] 'Other options': ${e instanceof Error ? e.message : e}`);
    }

    // Try TOTP passcode if available
    if (duoTotpSecret) {
      const hasPasscode = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a")).some(
          (a) => /Duo Mobile passcode|Enter a Passcode/i.test(a.textContent || ""),
        );
      });

      if (hasPasscode) {
        console.log("[hcm] Using Duo TOTP passcode.");
        await page.evaluate(() => {
          const el = Array.from(document.querySelectorAll("a")).find(
            (a) => /Duo Mobile passcode|Enter a Passcode/i.test(a.textContent || ""),
          ) as HTMLElement | undefined;
          el?.click();
        });
        await page.waitForTimeout(1000);

        const code = generateDuoPasscode(duoTotpSecret);
        const passcodeInput = page.locator(
          'input[name="passcode-input"], input[name="passcode"], input.passcode-input',
        );
        await passcodeInput.first().waitFor({ state: "visible", timeout: 10000 });
        await passcodeInput.first().fill(code);

        const verifyBtn = page.locator(
          'button:has-text("Verify"), button:has-text("Submit"), button:has-text("Log In")',
        );
        await verifyBtn.first().click();
        console.log("[hcm] TOTP code submitted.");
        duoHandled = true;
      }
    }

    // Fall back to Duo Push
    if (!duoHandled) {
      try {
        console.log("[hcm] Sending Duo Push...");
        const pushed = await page.evaluate(() => {
          const el = Array.from(document.querySelectorAll("a")).find(
            (a) => /Duo Push/i.test(a.textContent || ""),
          ) as HTMLElement | undefined;
          if (el) { el.click(); return true; }
          return false;
        });
        if (pushed) {
          console.log("[hcm] Duo Push sent — approve on your phone.");
          // Wait for Duo Verified Push verification code to appear
          await page.waitForTimeout(3000);
          try {
            const verifyCode = await page.evaluate(() => {
              // Duo Verified Push shows a 3-digit code the user enters in the app
              const allEls = Array.from(document.querySelectorAll("h2, h3, div, span, p"));
              for (const el of allEls) {
                const text = el.textContent?.trim() ?? "";
                if (/^\d{3}$/.test(text)) return text;
              }
              return null;
            });
            if (verifyCode) {
              console.log(`\n[hcm] *** DUO VERIFICATION CODE: ${verifyCode} ***\n`);
            }
          } catch { /* no verification code */ }
        } else {
          console.log("[hcm] No Duo Push option found. Waiting for manual approval...");
        }
      } catch (e) {
        console.log(`[hcm] Duo Push: ${e instanceof Error ? e.message : e}`);
      }
    }
  } catch (e) {
    console.log(`[hcm] Duo: ${e instanceof Error ? e.message : e}`);
  }

  // Poll for PeopleSoft session (up to 5 minutes)
  console.log("[hcm] Waiting for PeopleSoft session...");
  let loggedIn = false;
  let trustClicked = false;
  for (let i = 0; i < 300; i++) {
    const currentUrl = page.url();

    if (!trustClicked) {
      try {
        const trustBtn = page.locator(
          'button:has-text("Yes, this is my device"), button:has-text("Trust"), button:has-text("Yes")',
        );
        if (await trustBtn.first().isVisible({ timeout: 500 })) {
          await trustBtn.first().click();
          trustClicked = true;
          console.log("[hcm] Clicked 'Yes, this is my device'.");
        }
      } catch { /* not visible */ }
    }

    if (
      currentUrl.includes("hcm.case.edu") &&
      !currentUrl.includes("login.case.edu") &&
      !currentUrl.includes("cas/login") &&
      !currentUrl.includes("duosecurity.com") &&
      !currentUrl.includes("duo.com")
    ) {
      const cookies = await context.cookies();
      if (cookies.find((c) => c.name === "PS_TOKEN" || c.name === "PS_TOKEN_2")) {
        loggedIn = true;
        break;
      }
      if (cookies.some((c) => c.domain.includes("case.edu") && c.name.includes("SESSION"))) {
        loggedIn = true;
        break;
      }
      if (await page.locator("#pthdr2container, .ps_header, #PT_WORK").isVisible().catch(() => false)) {
        loggedIn = true;
        break;
      }
    }

    if (i % 30 === 0 && i > 0) {
      console.log(`[hcm] Still waiting... (${i}s, URL: ${currentUrl.slice(0, 80)})`);
    }
    await page.waitForTimeout(1000);
  }

  if (!loggedIn) {
    throw new Error("Login timed out after 5 minutes.");
  }

  console.log("[hcm] PeopleSoft session established.");
}

async function updateStoredCookies(
  manager: HcmClientManager,
  account: string,
  context: BrowserContext,
  page: Page,
): Promise<void> {
  try {
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
    } catch { /* best-effort */ }

    const finalCookies = await context.cookies();
    const allCookies: Record<string, string> = {};
    const cookieDetails: Array<{
      name: string; value: string; domain: string; path: string;
      httpOnly?: boolean; secure?: boolean; sameSite?: "Strict" | "Lax" | "None"; expires?: number;
    }> = [];
    for (const c of finalCookies) {
      allCookies[c.name] = c.value;
      cookieDetails.push({
        name: c.name, value: c.value, domain: c.domain, path: c.path,
        httpOnly: c.httpOnly, secure: c.secure,
        sameSite: c.sameSite as "Strict" | "Lax" | "None",
        expires: c.expires,
      });
    }

    manager.setCredentials(account, {
      cookies: allCookies,
      cookie_details: cookieDetails,
      employee_name: employeeName,
    });
    console.log(`[hcm] Updated stored cookies (${cookieDetails.length} cookies).`);
  } catch (e) {
    console.log(`[hcm] Failed to update stored cookies: ${e instanceof Error ? e.message : e}`);
  }
}

/**
 * Dump the PeopleSoft page structure for debugging navigation.
 */
export async function dumpPageInfo(page: Page): Promise<void> {
  const info = await page.evaluate(() => {
    const result: Record<string, unknown> = {};
    result.title = document.title;
    result.url = location.href;
    result.bodyText = document.body?.innerText?.slice(0, 3000) || "";
    result.bodyHtml = document.body?.innerHTML?.slice(0, 1000) || "";

    result.iframes = Array.from(document.querySelectorAll("iframe, frame")).map((f) => ({
      tag: f.tagName, id: f.id,
      src: (f as HTMLIFrameElement).src?.slice(0, 200),
      name: (f as HTMLIFrameElement).name,
    }));

    result.framesets = Array.from(document.querySelectorAll("frameset")).map((f) => ({
      cols: f.getAttribute("cols"),
      rows: f.getAttribute("rows"),
    }));

    result.links = Array.from(document.querySelectorAll("a[href]"))
      .slice(0, 40)
      .map((a) => ({
        href: (a as HTMLAnchorElement).href?.slice(0, 120),
        text: a.textContent?.trim().slice(0, 80) || "",
      }));

    return result;
  });
  console.log("[hcm] PAGE DUMP (main):", JSON.stringify(info, null, 2));

  const frames = page.frames();
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    try {
      const frameInfo = await frame.evaluate(() => ({
        url: location.href,
        title: document.title,
        bodyText: document.body?.innerText?.slice(0, 2000) || "",
      }));
      if (frameInfo.bodyText || frameInfo.title) {
        console.log(`[hcm] FRAME[${i}]:`, JSON.stringify(frameInfo, null, 2));
      }
    } catch { /* cross-origin frame */ }
  }
}

/**
 * Navigate to the Time tile from PeopleSoft Employee Self Service.
 */
export async function navigateToTimeTile(page: Page): Promise<void> {
  const currentUrl = page.url();
  if (currentUrl.includes("TIME") || currentUrl.includes("TL_")) {
    console.log("[hcm] Already on a time-related page.");
    return;
  }

  await dumpPageInfo(page);

  try {
    const timeEl = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("a, button, div[role='button'], [onclick]"));
      const el = candidates.find(
        (c) => /^Time$|Time\s*(and\s*Labor|Sheet|Entry|Reporting)/i.test(c.textContent?.trim() || ""),
      ) as HTMLElement | undefined;
      if (el) { el.click(); return el.textContent?.trim().slice(0, 80); }
      return null;
    });
    if (timeEl) {
      console.log(`[hcm] Clicked time element: "${timeEl}"`);
      await page.waitForTimeout(3000);
      return;
    }
  } catch { /* continue */ }

  throw new Error("Could not navigate to Time page. Check page dump above for DOM structure.");
}
