import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { homedir } from "os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { chromium } from "playwright";

const SESSIONS_PATH = join(homedir(), ".openclaw", "linkedin-sessions.json");

interface SessionData {
  cookies: Record<string, string>;
  csrfToken?: string;
  userAgent: string;
  capturedAt: number;
}

function loadSessions(): Record<string, SessionData> {
  if (!existsSync(SESSIONS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SESSIONS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveSessions(data: Record<string, SessionData>): void {
  const dir = dirname(SESSIONS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SESSIONS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const account = (body.account as string)?.trim() || "default";

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://www.linkedin.com/login");

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

    const jsessionId = cookies["JSESSIONID"] ?? "";
    const csrfToken = jsessionId.replace(/^"|"$/g, "");

    const userAgent = await page.evaluate(() => navigator.userAgent);
    await browser.close();

    const session: SessionData = { cookies, csrfToken, userAgent, capturedAt: Date.now() };
    const sessions = loadSessions();
    sessions[account] = session;
    saveSessions(sessions);

    return NextResponse.json({ success: true, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
