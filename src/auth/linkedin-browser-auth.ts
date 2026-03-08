import type { SessionStore, SessionData } from "./session-store.js";

export async function authenticateLinkedin(
  sessionStore: SessionStore,
  account: string = "default",
): Promise<SessionData> {
  // Dynamic import so playwright is only loaded when auth is actually called,
  // not at MCP server startup. This avoids crashes if playwright isn't installed.
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.linkedin.com/login");

  // Wait for the user to complete login — generous timeout for MFA/CAPTCHA
  await page.waitForURL(
    (url) =>
      !url.pathname.includes("/login") &&
      !url.pathname.includes("/signin") &&
      !url.pathname.includes("/checkpoint"),
    { timeout: 120_000 },
  );

  const allCookies = await context.cookies();
  const cookies: Record<string, string> = {};
  for (const c of allCookies) cookies[c.name] = c.value;

  // LinkedIn CSRF: strip quotes from JSESSIONID cookie
  const jsessionId = cookies["JSESSIONID"] ?? "";
  const csrfToken = jsessionId.replace(/^"|"$/g, "");

  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();

  const session: SessionData = { cookies, csrfToken, userAgent, capturedAt: Date.now() };
  sessionStore.set(account, session);
  return session;
}
