import type { SessionStore, SessionData } from "./session-store.js";

export async function authenticateInstagram(
  sessionStore: SessionStore,
  account: string = "default",
): Promise<SessionData> {
  // Dynamic import so playwright is only loaded when auth is actually called,
  // not at MCP server startup. This avoids crashes if playwright isn't installed.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.instagram.com/accounts/login/");

  // Wait for the user to complete login — generous timeout for MFA/CAPTCHA
  await page.waitForURL(
    (url) =>
      !url.pathname.includes("/accounts/login") &&
      !url.pathname.includes("/challenge/"),
    { timeout: 120_000 },
  );

  const allCookies = await context.cookies();
  const cookies: Record<string, string> = {};
  for (const c of allCookies) cookies[c.name] = c.value;

  // Instagram CSRF: use csrftoken cookie directly (no quote stripping needed)
  const csrfToken = cookies["csrftoken"] ?? "";

  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();

  const session: SessionData = { cookies, csrfToken, userAgent, capturedAt: Date.now() };
  sessionStore.set(account, session);
  return session;
}
