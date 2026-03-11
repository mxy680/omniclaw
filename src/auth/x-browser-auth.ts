import type { SessionStore, SessionData } from "./session-store.js";

export async function authenticateX(
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

  await page.goto("https://x.com/i/flow/login");

  // Wait for auth_token cookie — the true indicator of successful login.
  // The URL may change before the cookie is set (2FA, consent screens),
  // so we poll cookies directly instead of relying on URL patterns.
  const cookieDeadline = Date.now() + 120_000;
  let allCookies;
  while (Date.now() < cookieDeadline) {
    allCookies = await context.cookies();
    if (allCookies.some((c: { name: string }) => c.name === "auth_token")) break;
    await page.waitForTimeout(1000);
  }
  if (!allCookies) allCookies = await context.cookies();

  const cookies: Record<string, string> = {};
  for (const c of allCookies) cookies[c.name] = c.value;

  if (!cookies["auth_token"]) {
    await browser.close();
    throw new Error("Login did not complete — auth_token cookie not found.");
  }

  // X CSRF token is the ct0 cookie
  const csrfToken = cookies["ct0"] ?? "";

  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();

  const session: SessionData = { cookies, csrfToken, userAgent, capturedAt: Date.now() };
  sessionStore.set(account, session);
  return session;
}
