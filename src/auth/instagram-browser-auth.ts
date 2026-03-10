import type { SessionStore, SessionData } from "./session-store.js";

export async function authenticateInstagram(
  sessionStore: SessionStore,
  account: string = "default",
): Promise<SessionData> {
  // Dynamic import so playwright is only loaded when auth is actually called,
  // not at MCP server startup. This avoids crashes if playwright isn't installed.
  const pw: string = "playwright";
  const { chromium } = await import(pw);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.instagram.com/accounts/login/");

  // Wait for sessionid cookie — the true indicator of successful login.
  // The URL may change before the cookie is set (onetap, consent screens),
  // so we poll cookies directly instead of relying on URL patterns.
  const cookieDeadline = Date.now() + 120_000;
  let allCookies;
  while (Date.now() < cookieDeadline) {
    allCookies = await context.cookies();
    if (allCookies.some((c: { name: string }) => c.name === "sessionid")) break;
    await page.waitForTimeout(1000);
  }
  if (!allCookies) allCookies = await context.cookies();

  const cookies: Record<string, string> = {};
  for (const c of allCookies) cookies[c.name] = c.value;

  if (!cookies["sessionid"]) {
    await browser.close();
    throw new Error("Login did not complete — sessionid cookie not found.");
  }

  // Instagram CSRF: use csrftoken cookie directly (no quote stripping needed)
  const csrfToken = cookies["csrftoken"] ?? "";

  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();

  const session: SessionData = { cookies, csrfToken, userAgent, capturedAt: Date.now() };
  sessionStore.set(account, session);
  return session;
}
