// src/tools/hcm-browser.ts
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { HcmClientManager } from "../auth/hcm-client-manager.js";
import { HCM_BASE_URL } from "../auth/hcm-client-manager.js";

export interface HcmBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Launches a headless Playwright browser with stored HCM session cookies.
 * Navigates to hcm.case.edu and verifies session is still valid.
 * Throws if session expired (caller should return AUTH_REQUIRED).
 */
export async function launchHcmBrowser(
  manager: HcmClientManager,
  account: string,
): Promise<HcmBrowserSession> {
  const session = manager.getCredentials(account);
  if (!session) {
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

  await context.addCookies(
    session.cookie_details.map((c) => ({
      ...c,
      sameSite: "Lax" as const,
    })),
  );

  const page = await context.newPage();
  await page.goto(HCM_BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  const url = page.url();
  if (url.includes("login.case.edu") || url.includes("cas/login")) {
    await browser.close();
    throw new Error("HCM session expired");
  }

  return { browser, context, page };
}

/**
 * Navigate to the Time tile from PeopleSoft Employee Self Service.
 */
export async function navigateToTimeTile(page: Page): Promise<void> {
  const timeTile = page.locator(
    'div:has-text("Time"):not(:has(div)):visible, ' +
    'a:has-text("Time"):visible, ' +
    'span:has-text("Time"):visible, ' +
    '[id*="TIME"]:visible, ' +
    '[id*="TL_"]:visible',
  );

  try {
    await timeTile.first().waitFor({ state: "visible", timeout: 10000 });
    await timeTile.first().click();
    console.log("[hcm] Clicked Time tile.");
  } catch {
    console.log("[hcm] Time tile not found directly. Trying NavBar...");
    const navBar = page.locator('#PT_ACTION_MENU, button[title="NavBar"], .pthdr2navbaricon');
    await navBar.first().click();
    await page.waitForTimeout(1000);

    const selfService = page.locator('a:has-text("Employee Self Service"), span:has-text("Employee Self Service")');
    await selfService.first().click();
    await page.waitForTimeout(1000);

    const timeLink = page.locator('a:has-text("Time"), span:has-text("Time")');
    await timeLink.first().click();
  }

  await page.waitForTimeout(2000);
  console.log(`[hcm] Time page loaded at: ${page.url()}`);
}
