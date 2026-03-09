#!/usr/bin/env node
/**
 * Standalone script to authenticate with Instagram via Playwright.
 * Spawned by the web app's /api/auth/instagram route.
 *
 * Usage: node scripts/instagram-auth.mjs [account]
 *
 * Opens a visible browser, waits for login, captures cookies,
 * and writes them to ~/.openclaw/instagram-sessions.json.
 */

import { createRequire } from "module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

// Resolve playwright from the plugin's node_modules, not from the script's
// real path (which may differ due to Conductor workspace symlinks).
const pluginRoot = join(homedir(), ".openclaw", "current-plugin");
const require = createRequire(join(pluginRoot, "node_modules", "_placeholder.js"));
const { chromium } = require("playwright");

const account = process.argv[2] || "default";
const SESSIONS_PATH = join(homedir(), ".openclaw", "instagram-sessions.json");

function loadSessions() {
  if (!existsSync(SESSIONS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SESSIONS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveSessions(data) {
  const dir = dirname(SESSIONS_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SESSIONS_PATH, JSON.stringify(data, null, 2), "utf-8");
}

try {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://www.instagram.com/accounts/login/");

  await page.waitForURL(
    (url) =>
      !url.pathname.includes("/accounts/login") &&
      !url.pathname.includes("/challenge/"),
    { timeout: 120_000 },
  );

  const allCookies = await context.cookies();
  const cookies = {};
  for (const c of allCookies) cookies[c.name] = c.value;

  const csrfToken = cookies["csrftoken"] ?? "";

  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();

  const session = { cookies, csrfToken, userAgent, capturedAt: Date.now() };
  const sessions = loadSessions();
  sessions[account] = session;
  saveSessions(sessions);

  console.log(JSON.stringify({ success: true, account }));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
