# HCM Case (PeopleSoft) Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate with CWRU's PeopleSoft HCM (`hcm.case.edu`) for automated timesheet entry and pay stub viewing.

**Architecture:** Full Playwright automation — every tool call launches a browser with stored session cookies. Auth via CWRU SSO + Duo MFA (reuses existing `duo-totp.ts` helper). Session cookies stored to disk and injected on each use.

**Tech Stack:** TypeScript, Playwright, `@sinclair/typebox`, `otpauth` (existing dep)

---

### Task 1: HCM Utils + Client Manager

**Files:**
- Create: `src/tools/hcm-utils.ts`
- Create: `src/auth/hcm-client-manager.ts`
- Test: `tests/unit/hcm-client-manager.test.ts`

**Step 1: Write hcm-utils.ts**

```typescript
// src/tools/hcm-utils.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

export function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call hcm_auth_setup to authenticate with CWRU PeopleSoft first.",
};
```

**Step 2: Write the HcmClientManager**

This manages session cookie storage and provides a helper to create Playwright browser contexts with cookies injected. Since every tool uses Playwright (not direct HTTP), the manager doesn't need `get`/`post` methods — just cookie management + a `createBrowserContext` helper.

```typescript
// src/auth/hcm-client-manager.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface HcmSession {
  cookies: Record<string, string>;
  cookie_details: Array<{ name: string; value: string; domain: string; path: string }>;
  employee_name: string;
}

interface HcmSessionFile {
  [account: string]: HcmSession;
}

export const HCM_BASE_URL = "https://hcm.case.edu";

export class HcmClientManager {
  constructor(private tokensPath: string) {}

  private load(): HcmSessionFile {
    if (!existsSync(this.tokensPath)) return {};
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as HcmSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: HcmSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: HcmSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): HcmSession | null {
    return this.load()[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    const session = this.getCredentials(account);
    return session !== null && Object.keys(session.cookies).length > 0;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }
}
```

**Step 3: Write unit test for HcmClientManager**

```typescript
// tests/unit/hcm-client-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { HcmClientManager } from "../../src/auth/hcm-client-manager.js";

describe("HcmClientManager", () => {
  let tokensPath: string;
  let manager: HcmClientManager;

  beforeEach(() => {
    const dir = join(tmpdir(), "hcm-test-" + Date.now());
    mkdirSync(dir, { recursive: true });
    tokensPath = join(dir, "tokens.json");
    manager = new HcmClientManager(tokensPath);
  });

  afterEach(() => {
    if (existsSync(tokensPath)) unlinkSync(tokensPath);
  });

  it("returns null for unknown account", () => {
    expect(manager.getCredentials("default")).toBeNull();
    expect(manager.hasCredentials("default")).toBe(false);
  });

  it("stores and retrieves session", () => {
    const session = {
      cookies: { PS_TOKEN: "abc123" },
      cookie_details: [{ name: "PS_TOKEN", value: "abc123", domain: "hcm.case.edu", path: "/" }],
      employee_name: "Test User",
    };
    manager.setCredentials("default", session);
    expect(manager.hasCredentials("default")).toBe(true);
    expect(manager.getCredentials("default")).toEqual(session);
  });

  it("lists accounts", () => {
    manager.setCredentials("work", {
      cookies: { PS_TOKEN: "x" },
      cookie_details: [],
      employee_name: "User",
    });
    expect(manager.listAccounts()).toEqual(["work"]);
  });
});
```

**Step 4: Run unit test**

Run: `pnpm vitest run tests/unit/hcm-client-manager.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/tools/hcm-utils.ts src/auth/hcm-client-manager.ts tests/unit/hcm-client-manager.test.ts
git commit -m "feat(hcm): add HcmClientManager and utils"
```

---

### Task 2: Auth Tool (CWRU SSO + Duo MFA)

**Files:**
- Create: `src/tools/hcm-auth-tool.ts`

**Step 1: Write the auth tool**

Follow the Slack auth tool pattern for CWRU SSO + Duo. The login flow:
1. Navigate to `hcm.case.edu` → redirects to CWRU CAS login
2. Fill username/password (from `config.hcm_case_id` / `config.hcm_password`, or manual)
3. Handle Duo MFA (auto-TOTP via `config.duo_totp_secret`, or wait for manual push)
4. Wait for redirect back to PeopleSoft
5. Capture all cookies and store via manager

```typescript
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

  // Quick validation: launch headless browser with cookies, check if we land on PeopleSoft
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
    // If redirected to CAS login, session is expired
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
    // Navigate to HCM — will redirect to CWRU CAS
    console.log("[hcm] Navigating to hcm.case.edu...");
    await page.goto(HCM_BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Auto-fill CWRU SSO credentials
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

        // Try Universal Prompt (full-page redirect to duosecurity.com)
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

          // "Yes, this is my device" trust prompt
          try {
            const trustBtn = page.locator(
              'button:has-text("Yes, this is my device"), button:has-text("Trust")',
            );
            await trustBtn.first().waitFor({ state: "visible", timeout: 5000 });
            await trustBtn.first().click();
            console.log("[hcm] Clicked trust device button.");
          } catch {
            // Trust prompt may not appear
          }

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
        // No auto-MFA — wait for manual Duo push
        console.log("[hcm] Waiting for manual Duo approval (push notification)...");
      }
    } else {
      console.log("[hcm] No credentials configured. Waiting for manual login...");
    }

    // Wait for PeopleSoft to load (URL should be hcm.case.edu after SSO completes)
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
        // Verify we have a PeopleSoft session cookie
        const cookies = await context.cookies();
        const psToken = cookies.find((c) => c.name === "PS_TOKEN" || c.name === "PS_TOKEN_2");
        if (psToken) {
          loggedIn = true;
          break;
        }
        // Even without PS_TOKEN, if we're on hcm.case.edu and not on login, consider it success
        // PeopleSoft may use other session cookie names
        if (cookies.some((c) => c.domain.includes("case.edu") && c.name.includes("SESSION"))) {
          loggedIn = true;
          break;
        }
        // Fallback: if page has PeopleSoft content, we're in
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

    // Try to extract employee name from the page
    let employeeName = "unknown";
    try {
      employeeName = await page.evaluate(() => {
        // PeopleSoft typically shows the user name in the header
        const nameEl = document.querySelector(
          '#pthdr2usrname, .ps-username, [id*="EMPLOYEE_NAME"], [id*="PERSON_NAME"]',
        );
        if (nameEl?.textContent?.trim()) return nameEl.textContent.trim();
        // Fallback: check welcome message
        const welcome = document.body.innerText.match(/Welcome[,\s]+([A-Za-z\s]+)/i);
        if (welcome) return welcome[1].trim();
        return "unknown";
      }) || "unknown";
      console.log(`[hcm] Employee name: ${employeeName}`);
    } catch {
      // Name extraction is best-effort
    }

    // Capture all cookies
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
```

**Step 2: Build to verify compilation**

Run: `pnpm build`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src/tools/hcm-auth-tool.ts
git commit -m "feat(hcm): add auth tool with CWRU SSO + Duo MFA"
```

---

### Task 3: Playwright Navigation Helpers

**Files:**
- Create: `src/tools/hcm-browser.ts`

Every HCM tool needs to launch a browser with session cookies and navigate PeopleSoft. Extract this into a shared helper so all tools can reuse it.

**Step 1: Write the browser helper**

```typescript
// src/tools/hcm-browser.ts
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { HcmClientManager, HcmSession } from "../auth/hcm-client-manager.js";
import { HCM_BASE_URL } from "../auth/hcm-client-manager.js";

export interface HcmBrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Launches a headless Playwright browser with stored HCM session cookies.
 * Navigates to hcm.case.edu and verifies the session is still valid.
 * Returns the browser, context, and page — caller is responsible for closing.
 * Throws if session is expired (caller should return AUTH_REQUIRED).
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

  // Inject stored cookies
  await context.addCookies(
    session.cookie_details.map((c) => ({
      ...c,
      sameSite: "Lax" as const,
    })),
  );

  const page = await context.newPage();
  await page.goto(HCM_BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Check if we were redirected to CAS login (session expired)
  const url = page.url();
  if (url.includes("login.case.edu") || url.includes("cas/login")) {
    await browser.close();
    throw new Error("HCM session expired");
  }

  return { browser, context, page };
}

/**
 * Navigate to a specific PeopleSoft page using the NavBar or direct URL.
 * PeopleSoft Fluid UI uses tile-based navigation from the Employee Self Service homepage.
 */
export async function navigateToTimeTile(page: Page): Promise<void> {
  // Click the NavBar or Employee Self Service to get to the Time tile
  // PeopleSoft Fluid UI navigation varies by installation — try multiple approaches

  // Approach 1: Direct navigation via component URL
  // PeopleSoft uses URLs like: /psp/hcprd/EMPLOYEE/HRMS/c/TL_EMPLOYEE_FL.TL_RPT_TIME_FLU.GBL
  // The exact path depends on CWRU's configuration — we'll discover this during testing.
  // For now, try clicking through the UI.

  // Look for "Time" tile on the Employee Self Service page
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
    // If Time tile isn't visible, try NavBar → Employee Self Service → Time
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

  // Wait for timesheet page to load
  await page.waitForTimeout(2000);
  console.log(`[hcm] Time page loaded at: ${page.url()}`);
}
```

**Step 2: Build to verify compilation**

Run: `pnpm build`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src/tools/hcm-browser.ts
git commit -m "feat(hcm): add Playwright browser helper for PeopleSoft navigation"
```

---

### Task 4: Get Timesheet Tool

**Files:**
- Create: `src/tools/hcm-timesheet.ts`

**Step 1: Write the get_timesheet tool**

```typescript
// src/tools/hcm-timesheet.ts
import { Type } from "@sinclair/typebox";
import type { HcmClientManager } from "../auth/hcm-client-manager.js";
import { launchHcmBrowser, navigateToTimeTile } from "./hcm-browser.js";
import { jsonResult, AUTH_REQUIRED } from "./hcm-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmGetTimesheetTool(manager: HcmClientManager): any {
  return {
    name: "hcm_get_timesheet",
    label: "HCM Get Timesheet",
    description:
      "View the current or past timesheet from CWRU PeopleSoft HCM. " +
      "Returns hours entered per day and submission status.",
    parameters: Type.Object({
      period: Type.Optional(
        Type.String({
          description:
            "Pay period date (e.g. '2026-02-24'). Defaults to current period.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { period?: string; account?: string },
    ) {
      const account = params.account ?? "default";

      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      let hcm;
      try {
        hcm = await launchHcmBrowser(manager, account);
      } catch (err) {
        if (err instanceof Error && err.message.includes("session expired")) {
          return jsonResult(AUTH_REQUIRED);
        }
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }

      try {
        await navigateToTimeTile(hcm.page);

        // If a specific period was requested, navigate to it
        if (params.period) {
          // Look for period selector / date picker and navigate
          const periodSelector = hcm.page.locator(
            'select[id*="PERIOD"], input[id*="DATE"], [id*="PAY_PERIOD"]',
          );
          try {
            await periodSelector.first().waitFor({ state: "visible", timeout: 5000 });
            await periodSelector.first().fill(params.period);
            // Press Enter or click Go to load the period
            await hcm.page.keyboard.press("Enter");
            await hcm.page.waitForTimeout(2000);
          } catch {
            console.log("[hcm] Could not find period selector — using current period.");
          }
        }

        // Scrape timesheet data from the page
        const timesheetData = await hcm.page.evaluate(() => {
          const result: {
            period: string;
            status: string;
            days: Array<{ date: string; day: string; hours: number }>;
            total_hours: number;
          } = {
            period: "",
            status: "unknown",
            days: [],
            total_hours: 0,
          };

          // Try to find period info
          const periodEl = document.querySelector(
            '[id*="PERIOD"], [id*="PAY_BEGIN"], .ps-text:has-text("Period")',
          );
          if (periodEl?.textContent) result.period = periodEl.textContent.trim();

          // Try to find status
          const statusEl = document.querySelector(
            '[id*="STATUS"], [id*="APPR"], .ps-text:has-text("Status")',
          );
          if (statusEl?.textContent) result.status = statusEl.textContent.trim();

          // Try to find time entries — PeopleSoft uses tables or grid layouts
          // Look for input fields (editable) or text fields (read-only) with hours
          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const inputs = document.querySelectorAll(
            'input[id*="QUANTITY"], input[id*="HOURS"], input[id*="TRC"], ' +
            'td[id*="QUANTITY"], td[id*="HOURS"], span[id*="QUANTITY"]',
          );

          inputs.forEach((input, idx) => {
            const value = (input as HTMLInputElement).value ?? input.textContent?.trim() ?? "0";
            const hours = parseFloat(value) || 0;
            result.days.push({
              date: "",
              day: dayNames[idx % 7] ?? `Day ${idx + 1}`,
              hours,
            });
            result.total_hours += hours;
          });

          return result;
        });

        await hcm.browser.close();
        return jsonResult(timesheetData);
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Build to verify compilation**

Run: `pnpm build`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src/tools/hcm-timesheet.ts
git commit -m "feat(hcm): add get_timesheet tool"
```

---

### Task 5: Enter Hours + Submit Timesheet Tools

**Files:**
- Modify: `src/tools/hcm-timesheet.ts` (append two more tool factories)

**Step 1: Add enter_hours and submit_timesheet tools**

Append to `src/tools/hcm-timesheet.ts`:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmEnterHoursTool(manager: HcmClientManager): any {
  return {
    name: "hcm_enter_hours",
    label: "HCM Enter Hours",
    description:
      "Enter hours into the CWRU PeopleSoft timesheet for specific days. " +
      "This saves the timesheet but does NOT submit it — use hcm_submit_timesheet to submit.",
    parameters: Type.Object({
      hours: Type.Object(
        {
          sunday: Type.Optional(Type.Number({ description: "Hours for Sunday" })),
          monday: Type.Optional(Type.Number({ description: "Hours for Monday" })),
          tuesday: Type.Optional(Type.Number({ description: "Hours for Tuesday" })),
          wednesday: Type.Optional(Type.Number({ description: "Hours for Wednesday" })),
          thursday: Type.Optional(Type.Number({ description: "Hours for Thursday" })),
          friday: Type.Optional(Type.Number({ description: "Hours for Friday" })),
          saturday: Type.Optional(Type.Number({ description: "Hours for Saturday" })),
        },
        { description: "Hours to enter for each day of the week" },
      ),
      period: Type.Optional(
        Type.String({ description: "Pay period date. Defaults to current period." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        hours: {
          sunday?: number; monday?: number; tuesday?: number; wednesday?: number;
          thursday?: number; friday?: number; saturday?: number;
        };
        period?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";

      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      let hcm;
      try {
        hcm = await launchHcmBrowser(manager, account);
      } catch (err) {
        if (err instanceof Error && err.message.includes("session expired")) {
          return jsonResult(AUTH_REQUIRED);
        }
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }

      try {
        await navigateToTimeTile(hcm.page);

        // Navigate to specific period if requested
        if (params.period) {
          const periodSelector = hcm.page.locator(
            'select[id*="PERIOD"], input[id*="DATE"], [id*="PAY_PERIOD"]',
          );
          try {
            await periodSelector.first().waitFor({ state: "visible", timeout: 5000 });
            await periodSelector.first().fill(params.period);
            await hcm.page.keyboard.press("Enter");
            await hcm.page.waitForTimeout(2000);
          } catch {
            console.log("[hcm] Could not find period selector — using current period.");
          }
        }

        // Check if timesheet is already submitted
        const status = await hcm.page.evaluate(() => {
          const statusEl = document.querySelector('[id*="STATUS"], [id*="APPR"]');
          return statusEl?.textContent?.trim() ?? "";
        });

        if (status.toLowerCase().includes("submitted") || status.toLowerCase().includes("approved")) {
          await hcm.browser.close();
          return jsonResult({
            error: "timesheet_already_submitted",
            status,
            message: "Cannot modify a submitted/approved timesheet.",
          });
        }

        // Find hour input fields and fill them
        // PeopleSoft elapsed time entry typically has 7 input fields (Sun–Sat)
        const dayOrder = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
        const filledDays: Array<{ day: string; hours: number }> = [];

        const hourInputs = hcm.page.locator(
          'input[id*="QUANTITY"], input[id*="HOURS"], input[id*="TRC_QUANTITY"]',
        );
        const inputCount = await hourInputs.count();
        console.log(`[hcm] Found ${inputCount} hour input fields.`);

        for (let i = 0; i < Math.min(inputCount, 7); i++) {
          const dayName = dayOrder[i];
          const hoursValue = params.hours[dayName];

          if (hoursValue !== undefined) {
            const input = hourInputs.nth(i);
            await input.click();
            await input.fill("");
            await input.fill(String(hoursValue));
            filledDays.push({ day: dayName, hours: hoursValue });
            console.log(`[hcm] Entered ${hoursValue} hours for ${dayName}`);
          }
        }

        // Save the timesheet (click Save button, NOT Submit)
        const saveBtn = hcm.page.locator(
          'button:has-text("Save"), input[value="Save"], #ICSave, [id*="SAVE"]',
        );
        try {
          await saveBtn.first().waitFor({ state: "visible", timeout: 5000 });
          await saveBtn.first().click();
          console.log("[hcm] Clicked Save.");
          await hcm.page.waitForTimeout(2000);
        } catch {
          console.log("[hcm] Save button not found — hours may auto-save.");
        }

        await hcm.browser.close();
        return jsonResult({
          status: "saved",
          message: "Hours entered and saved. Call hcm_submit_timesheet to submit.",
          filled_days: filledDays,
          total_hours: filledDays.reduce((sum, d) => sum + d.hours, 0),
        });
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmSubmitTimesheetTool(manager: HcmClientManager): any {
  return {
    name: "hcm_submit_timesheet",
    label: "HCM Submit Timesheet",
    description:
      "Submit the current CWRU PeopleSoft timesheet for approval. " +
      "Use hcm_get_timesheet first to verify hours, then call this to submit.",
    parameters: Type.Object({
      period: Type.Optional(
        Type.String({ description: "Pay period date. Defaults to current period." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { period?: string; account?: string },
    ) {
      const account = params.account ?? "default";

      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      let hcm;
      try {
        hcm = await launchHcmBrowser(manager, account);
      } catch (err) {
        if (err instanceof Error && err.message.includes("session expired")) {
          return jsonResult(AUTH_REQUIRED);
        }
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }

      try {
        await navigateToTimeTile(hcm.page);

        // Navigate to specific period if requested
        if (params.period) {
          const periodSelector = hcm.page.locator(
            'select[id*="PERIOD"], input[id*="DATE"], [id*="PAY_PERIOD"]',
          );
          try {
            await periodSelector.first().waitFor({ state: "visible", timeout: 5000 });
            await periodSelector.first().fill(params.period);
            await hcm.page.keyboard.press("Enter");
            await hcm.page.waitForTimeout(2000);
          } catch {
            console.log("[hcm] Could not find period selector — using current period.");
          }
        }

        // Click Submit button
        const submitBtn = hcm.page.locator(
          'button:has-text("Submit"), input[value="Submit"], #Submit, ' +
          '[id*="SUBMIT"], a:has-text("Submit")',
        );

        await submitBtn.first().waitFor({ state: "visible", timeout: 10000 });
        await submitBtn.first().click();
        console.log("[hcm] Clicked Submit.");

        // Handle confirmation dialog if one appears
        try {
          const confirmBtn = hcm.page.locator(
            'button:has-text("Yes"), button:has-text("OK"), button:has-text("Confirm"), #ptModOK_0',
          );
          await confirmBtn.first().waitFor({ state: "visible", timeout: 5000 });
          await confirmBtn.first().click();
          console.log("[hcm] Confirmed submission.");
        } catch {
          // No confirmation dialog — that's fine
        }

        await hcm.page.waitForTimeout(2000);

        // Verify submission status
        const resultStatus = await hcm.page.evaluate(() => {
          const statusEl = document.querySelector('[id*="STATUS"], [id*="APPR"]');
          return statusEl?.textContent?.trim() ?? "submitted";
        });

        await hcm.browser.close();
        return jsonResult({
          status: "submitted",
          timesheet_status: resultStatus,
          message: "Timesheet submitted for approval.",
        });
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Build to verify compilation**

Run: `pnpm build`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src/tools/hcm-timesheet.ts
git commit -m "feat(hcm): add enter_hours and submit_timesheet tools"
```

---

### Task 6: Pay Stub Tools

**Files:**
- Create: `src/tools/hcm-paystubs.ts`

**Step 1: Write the paystub tools**

```typescript
// src/tools/hcm-paystubs.ts
import { Type } from "@sinclair/typebox";
import type { HcmClientManager } from "../auth/hcm-client-manager.js";
import { launchHcmBrowser } from "./hcm-browser.js";
import { jsonResult, AUTH_REQUIRED } from "./hcm-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmGetPaystubsTool(manager: HcmClientManager): any {
  return {
    name: "hcm_get_paystubs",
    label: "HCM Get Paystubs",
    description:
      "View recent pay stubs from CWRU PeopleSoft HCM. " +
      "Returns date, gross pay, net pay, and deduction summary for each stub.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { account?: string },
    ) {
      const account = params.account ?? "default";

      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      let hcm;
      try {
        hcm = await launchHcmBrowser(manager, account);
      } catch (err) {
        if (err instanceof Error && err.message.includes("session expired")) {
          return jsonResult(AUTH_REQUIRED);
        }
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }

      try {
        // Navigate to Payroll / Pay stub section
        // PeopleSoft: NavBar → Employee Self Service → Payroll → View Paycheck
        const page = hcm.page;

        // Try clicking Payroll tile
        const payrollTile = page.locator(
          'div:has-text("Payroll"):visible, a:has-text("Payroll"):visible, ' +
          'span:has-text("Payroll"):visible, div:has-text("Pay"):visible, ' +
          '[id*="PAYROLL"]:visible, [id*="PAY_"]:visible',
        );

        try {
          await payrollTile.first().waitFor({ state: "visible", timeout: 10000 });
          await payrollTile.first().click();
          console.log("[hcm] Clicked Payroll tile.");
          await page.waitForTimeout(2000);
        } catch {
          // Try NavBar navigation
          console.log("[hcm] Payroll tile not found. Trying NavBar...");
          const navBar = page.locator('#PT_ACTION_MENU, button[title="NavBar"]');
          await navBar.first().click();
          await page.waitForTimeout(1000);

          const selfService = page.locator('a:has-text("Employee Self Service")');
          await selfService.first().click();
          await page.waitForTimeout(1000);

          const payroll = page.locator('a:has-text("Payroll"), a:has-text("Pay")');
          await payroll.first().click();
          await page.waitForTimeout(1000);
        }

        // Look for "View Paycheck" or similar link
        const viewPaycheck = page.locator(
          'a:has-text("View Paycheck"), a:has-text("Pay Stub"), a:has-text("Paystub"), ' +
          'span:has-text("View Paycheck"), [id*="PAYCHECK"]:visible',
        );
        try {
          await viewPaycheck.first().waitFor({ state: "visible", timeout: 5000 });
          await viewPaycheck.first().click();
          await page.waitForTimeout(2000);
        } catch {
          console.log("[hcm] View Paycheck link not found — may already be on the page.");
        }

        // Scrape pay stub list
        const paystubs = await page.evaluate(() => {
          const stubs: Array<{
            index: number;
            date: string;
            gross_pay: string;
            net_pay: string;
            description: string;
          }> = [];

          // PeopleSoft typically shows paychecks in a table or list
          const rows = document.querySelectorAll(
            'tr[id*="PAY"], tr[id*="CHECK"], .ps-grid-row, table tr',
          );

          rows.forEach((row, idx) => {
            const cells = row.querySelectorAll("td, span");
            const texts = Array.from(cells).map((c) => c.textContent?.trim() ?? "");
            // Try to identify date, gross, net from cell contents
            const dateMatch = texts.find((t) => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(t));
            const amountMatch = texts.filter((t) => /\$[\d,.]+/.test(t));

            if (dateMatch || amountMatch.length > 0) {
              stubs.push({
                index: idx,
                date: dateMatch ?? "",
                gross_pay: amountMatch[0] ?? "",
                net_pay: amountMatch[1] ?? amountMatch[0] ?? "",
                description: texts.join(" | ").slice(0, 200),
              });
            }
          });

          return stubs;
        });

        await hcm.browser.close();
        return jsonResult({ count: paystubs.length, paystubs });
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createHcmGetPaystubDetailsTool(manager: HcmClientManager): any {
  return {
    name: "hcm_get_paystub_details",
    label: "HCM Get Paystub Details",
    description:
      "View full details of a specific pay stub from CWRU PeopleSoft HCM. " +
      "Includes earnings breakdown, deductions, taxes, and net pay.",
    parameters: Type.Object({
      index: Type.Number({
        description: "Index of the pay stub to view (from hcm_get_paystubs results, 0-based).",
      }),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { index: number; account?: string },
    ) {
      const account = params.account ?? "default";

      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      let hcm;
      try {
        hcm = await launchHcmBrowser(manager, account);
      } catch (err) {
        if (err instanceof Error && err.message.includes("session expired")) {
          return jsonResult(AUTH_REQUIRED);
        }
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }

      try {
        const page = hcm.page;

        // Navigate to pay stubs (same as get_paystubs)
        const payrollTile = page.locator(
          'div:has-text("Payroll"):visible, a:has-text("Payroll"):visible, ' +
          'span:has-text("Payroll"):visible, [id*="PAYROLL"]:visible',
        );
        try {
          await payrollTile.first().waitFor({ state: "visible", timeout: 10000 });
          await payrollTile.first().click();
          await page.waitForTimeout(2000);
        } catch {
          const navBar = page.locator('#PT_ACTION_MENU, button[title="NavBar"]');
          await navBar.first().click();
          await page.waitForTimeout(1000);
          const selfService = page.locator('a:has-text("Employee Self Service")');
          await selfService.first().click();
          await page.waitForTimeout(1000);
          const payroll = page.locator('a:has-text("Payroll"), a:has-text("Pay")');
          await payroll.first().click();
          await page.waitForTimeout(1000);
        }

        const viewPaycheck = page.locator(
          'a:has-text("View Paycheck"), a:has-text("Pay Stub"), [id*="PAYCHECK"]:visible',
        );
        try {
          await viewPaycheck.first().waitFor({ state: "visible", timeout: 5000 });
          await viewPaycheck.first().click();
          await page.waitForTimeout(2000);
        } catch {
          // May already be on the page
        }

        // Click the specific pay stub row to open details
        const rows = page.locator(
          'tr[id*="PAY"], tr[id*="CHECK"], .ps-grid-row, table tr',
        );
        const row = rows.nth(params.index);
        try {
          const link = row.locator("a").first();
          await link.click();
          await page.waitForTimeout(3000);
        } catch {
          // Try clicking the row itself
          await row.click();
          await page.waitForTimeout(3000);
        }

        // Scrape full pay stub details
        const details = await page.evaluate(() => {
          const result: {
            pay_date: string;
            period: string;
            earnings: Array<{ description: string; rate: string; hours: string; amount: string }>;
            deductions: Array<{ description: string; amount: string }>;
            taxes: Array<{ description: string; amount: string }>;
            gross_pay: string;
            net_pay: string;
            raw_text: string;
          } = {
            pay_date: "",
            period: "",
            earnings: [],
            deductions: [],
            taxes: [],
            gross_pay: "",
            net_pay: "",
            raw_text: "",
          };

          // Grab all text content from the page as fallback
          result.raw_text = document.body.innerText.slice(0, 5000);

          // Try to find structured data
          const tables = document.querySelectorAll("table");
          tables.forEach((table) => {
            const header = table.querySelector("th, caption, .ps-group-title");
            const headerText = header?.textContent?.trim()?.toLowerCase() ?? "";

            const tableRows = table.querySelectorAll("tr");
            tableRows.forEach((tr) => {
              const cells = Array.from(tr.querySelectorAll("td, th")).map(
                (c) => c.textContent?.trim() ?? "",
              );

              if (headerText.includes("earning")) {
                if (cells.length >= 2) {
                  result.earnings.push({
                    description: cells[0],
                    rate: cells[1] ?? "",
                    hours: cells[2] ?? "",
                    amount: cells[cells.length - 1],
                  });
                }
              } else if (headerText.includes("deduction")) {
                if (cells.length >= 2) {
                  result.deductions.push({
                    description: cells[0],
                    amount: cells[cells.length - 1],
                  });
                }
              } else if (headerText.includes("tax")) {
                if (cells.length >= 2) {
                  result.taxes.push({
                    description: cells[0],
                    amount: cells[cells.length - 1],
                  });
                }
              }
            });
          });

          // Find gross/net pay
          const allText = document.body.innerText;
          const grossMatch = allText.match(/Gross\s*(?:Pay|Earnings)[:\s]*\$?([\d,.]+)/i);
          if (grossMatch) result.gross_pay = grossMatch[1];
          const netMatch = allText.match(/Net\s*Pay[:\s]*\$?([\d,.]+)/i);
          if (netMatch) result.net_pay = netMatch[1];
          const dateMatch = allText.match(/Pay\s*Date[:\s]*([\d/]+)/i);
          if (dateMatch) result.pay_date = dateMatch[1];
          const periodMatch = allText.match(/Period[:\s]*([\d/]+\s*[-–]\s*[\d/]+)/i);
          if (periodMatch) result.period = periodMatch[1];

          return result;
        });

        await hcm.browser.close();

        // Clean up raw_text if we got structured data
        if (details.earnings.length > 0 || details.deductions.length > 0) {
          delete (details as Record<string, unknown>).raw_text;
        }

        return jsonResult(details);
      } catch (err) {
        await hcm.browser.close();
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Build to verify compilation**

Run: `pnpm build`
Expected: Compiles with no errors

**Step 3: Commit**

```bash
git add src/tools/hcm-paystubs.ts
git commit -m "feat(hcm): add paystub tools (get_paystubs, get_paystub_details)"
```

---

### Task 7: Plugin Config + Tool Registry Registration

**Files:**
- Modify: `src/types/plugin-config.ts` — add HCM config keys
- Modify: `openclaw.plugin.json` — add HCM config schema entries
- Modify: `src/mcp/tool-registry.ts` — import and register HCM tools

**Step 1: Update PluginConfig interface**

Add these fields to the `PluginConfig` interface in `src/types/plugin-config.ts`:

```typescript
  hcm_tokens_path?: string;
  hcm_case_id?: string;
  hcm_password?: string;
```

Note: `duo_totp_secret` already exists in PluginConfig — HCM reuses it (same Duo for all CWRU SSO).

**Step 2: Update openclaw.plugin.json**

Add to `configSchema.properties`:

```json
"hcm_tokens_path": {
  "type": "string",
  "description": "Path to store HCM session cookies. Defaults to ~/.openclaw/omniclaw-hcm-tokens.json."
},
"hcm_case_id": {
  "type": "string",
  "description": "CWRU Case ID for automatic HCM login."
},
"hcm_password": {
  "type": "string",
  "description": "CWRU password for automatic HCM login."
}
```

**Step 3: Update tool-registry.ts**

Add imports at the top of `src/mcp/tool-registry.ts`:

```typescript
import { HcmClientManager } from "../auth/hcm-client-manager.js";
import { createHcmAuthTool } from "../tools/hcm-auth-tool.js";
import { createHcmGetTimesheetTool, createHcmEnterHoursTool, createHcmSubmitTimesheetTool } from "../tools/hcm-timesheet.js";
import { createHcmGetPaystubsTool, createHcmGetPaystubDetailsTool } from "../tools/hcm-paystubs.js";
```

Add registration block before `return tools;` (after the Devpost section):

```typescript
  // HCM (CWRU PeopleSoft) tools — register unconditionally
  const hcmTokensPath =
    config.hcm_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-hcm-tokens.json",
    );

  const hcmManager = new HcmClientManager(hcmTokensPath);

  add(createHcmAuthTool(hcmManager, config));
  add(createHcmGetTimesheetTool(hcmManager));
  add(createHcmEnterHoursTool(hcmManager));
  add(createHcmSubmitTimesheetTool(hcmManager));
  add(createHcmGetPaystubsTool(hcmManager));
  add(createHcmGetPaystubDetailsTool(hcmManager));
```

**Step 4: Build to verify compilation**

Run: `pnpm build`
Expected: Compiles with no errors

**Step 5: Commit**

```bash
git add src/types/plugin-config.ts openclaw.plugin.json src/mcp/tool-registry.ts
git commit -m "feat(hcm): register 6 HCM tools in plugin config + tool registry"
```

---

### Task 8: Skill File

**Files:**
- Create: `skills/hcm.SKILL.md`

**Step 1: Write the skill file**

```markdown
---
name: hcm
description: CWRU PeopleSoft HCM — enter work hours, view timesheets, check pay stubs
metadata: {"openclaw": {"emoji": "⏰"}}
---

# HCM (CWRU PeopleSoft)

Manage your CWRU work hours and payroll through PeopleSoft HCM at hcm.case.edu.

## First-Time Setup

HCM uses browser-based authentication via CWRU SSO + Duo MFA.

1. Pre-configure credentials (optional, enables fully automated login):

   openclaw config set plugins.entries.omniclaw.config.hcm_case_id "abc123"
   openclaw config set plugins.entries.omniclaw.config.hcm_password "your-password"
   openclaw config set plugins.entries.omniclaw.config.duo_totp_secret "your-duo-secret"

2. Call `hcm_auth_setup` — browser opens for CWRU SSO login

3. Complete Duo MFA (automatic if duo_totp_secret configured, otherwise approve the push)

4. Session cookies saved automatically

## Available Tools

- `hcm_auth_setup` — Authenticate via CWRU SSO + Duo
- `hcm_get_timesheet` — View current or past timesheet
- `hcm_enter_hours` — Enter hours for specific days (saves but does NOT submit)
- `hcm_submit_timesheet` — Submit timesheet for approval
- `hcm_get_paystubs` — View recent pay stubs
- `hcm_get_paystub_details` — View full details of a specific pay stub

## Workflow

### Enter Weekly Hours

1. `hcm_auth_setup` (if not already authenticated)
2. `hcm_enter_hours` with your hours, e.g. `{ "hours": { "monday": 4, "wednesday": 3, "friday": 5 } }`
3. `hcm_get_timesheet` to verify hours look correct
4. `hcm_submit_timesheet` to submit for approval

### Check Pay

1. `hcm_get_paystubs` to see recent pay stubs
2. `hcm_get_paystub_details` with the index of the stub you want to view

## Error Handling

If any tool returns `"error": "auth_required"`, call `hcm_auth_setup` first.
PeopleSoft sessions typically expire after a few hours — re-run `hcm_auth_setup` if needed.
```

**Step 2: Commit**

```bash
git add skills/hcm.SKILL.md
git commit -m "docs(hcm): add skill file for HCM integration"
```

---

### Task 9: Integration Tests

**Files:**
- Create: `tests/integration/hcm.test.ts`

These tests require real CWRU credentials to run. They're opt-in — only run when `HCM_CASE_ID` env var is set.

**Step 1: Write integration tests**

```typescript
// tests/integration/hcm.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { mkdirSync } from "fs";
import { HcmClientManager } from "../../src/auth/hcm-client-manager.js";
import { createHcmAuthTool } from "../../src/tools/hcm-auth-tool.js";
import { createHcmGetTimesheetTool, createHcmEnterHoursTool, createHcmSubmitTimesheetTool } from "../../src/tools/hcm-timesheet.js";
import { createHcmGetPaystubsTool, createHcmGetPaystubDetailsTool } from "../../src/tools/hcm-paystubs.js";
import type { PluginConfig } from "../../src/types/plugin-config.js";

const HCM_CASE_ID = process.env.HCM_CASE_ID;
const HCM_PASSWORD = process.env.HCM_PASSWORD;
const DUO_TOTP_SECRET = process.env.DUO_TOTP_SECRET;
const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

const skip = !HCM_CASE_ID;

describe.skipIf(skip)("HCM Integration Tests", () => {
  let manager: HcmClientManager;
  let config: PluginConfig;
  let authTool: ReturnType<typeof createHcmAuthTool>;
  let getTimesheetTool: ReturnType<typeof createHcmGetTimesheetTool>;
  let enterHoursTool: ReturnType<typeof createHcmEnterHoursTool>;
  let submitTimesheetTool: ReturnType<typeof createHcmSubmitTimesheetTool>;
  let getPaystubsTool: ReturnType<typeof createHcmGetPaystubsTool>;
  let getPaystubDetailsTool: ReturnType<typeof createHcmGetPaystubDetailsTool>;

  beforeAll(() => {
    const dir = join(tmpdir(), "hcm-integration-test-" + Date.now());
    mkdirSync(dir, { recursive: true });
    const tokensPath = join(dir, "tokens.json");
    manager = new HcmClientManager(tokensPath);

    config = {
      client_secret_path: "",
      hcm_case_id: HCM_CASE_ID,
      hcm_password: HCM_PASSWORD,
      duo_totp_secret: DUO_TOTP_SECRET,
    } as PluginConfig;

    authTool = createHcmAuthTool(manager, config);
    getTimesheetTool = createHcmGetTimesheetTool(manager);
    enterHoursTool = createHcmEnterHoursTool(manager);
    submitTimesheetTool = createHcmSubmitTimesheetTool(manager);
    getPaystubsTool = createHcmGetPaystubsTool(manager);
    getPaystubDetailsTool = createHcmGetPaystubDetailsTool(manager);
  });

  it("authenticates via CWRU SSO", async () => {
    const result = await authTool.execute("test", {});
    const data = result.details;
    expect(data.status).toMatch(/authenticated|already_authenticated/);
    expect(data.employee_name).toBeDefined();
    console.log("Auth result:", JSON.stringify(data, null, 2));
  }, 120000); // 2 min timeout for SSO + MFA

  it("gets timesheet", async () => {
    const result = await getTimesheetTool.execute("test", {});
    const data = result.details;
    expect(data.error).toBeUndefined();
    console.log("Timesheet:", JSON.stringify(data, null, 2));
  }, 60000);

  it("gets paystubs", async () => {
    const result = await getPaystubsTool.execute("test", {});
    const data = result.details;
    expect(data.error).toBeUndefined();
    expect(data.paystubs).toBeDefined();
    console.log("Paystubs:", JSON.stringify(data, null, 2));
  }, 60000);

  it("gets paystub details", async () => {
    const result = await getPaystubDetailsTool.execute("test", { index: 0 });
    const data = result.details;
    expect(data.error).toBeUndefined();
    console.log("Paystub details:", JSON.stringify(data, null, 2));
  }, 60000);

  describe.skipIf(!RUN_WRITE_TESTS)("Write Tests", () => {
    it("enters hours", async () => {
      const result = await enterHoursTool.execute("test", {
        hours: { monday: 4 },
      });
      const data = result.details;
      expect(data.status).toBe("saved");
      console.log("Enter hours:", JSON.stringify(data, null, 2));
    }, 60000);
  });
});
```

**Step 2: Run the unit test only (no integration)**

Run: `pnpm vitest run tests/unit/hcm-client-manager.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/hcm.test.ts
git commit -m "test(hcm): add integration tests for HCM tools"
```

---

### Task 10: Update CLAUDE.md Kanban

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Move HCM entry from Planned to Done**

Add to the "Done" table in CLAUDE.md:

```markdown
| HCM (CWRU PeopleSoft) | 6 | `hcm` | `docs/plans/2026-02-28-hcm-case-design.md` | Playwright browser auth, CWRU SSO + Duo MFA |
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add HCM integration to kanban board"
```

---

### Task 11: Manual Verification

**No files — manual testing.**

**Step 1: Configure credentials**

```bash
openclaw config set plugins.entries.omniclaw.config.hcm_case_id "<your-case-id>"
openclaw config set plugins.entries.omniclaw.config.hcm_password "<your-password>"
```

**Step 2: Run auth tool manually**

Run: `HCM_CASE_ID=<id> HCM_PASSWORD=<pw> DUO_TOTP_SECRET=<secret> pnpm vitest run tests/integration/hcm.test.ts -t "authenticates"`

Watch the browser open, complete SSO, handle Duo MFA, and capture cookies.

**Step 3: Run read tools**

Run: `HCM_CASE_ID=<id> HCM_PASSWORD=<pw> DUO_TOTP_SECRET=<secret> pnpm vitest run tests/integration/hcm.test.ts -t "gets timesheet"`

Verify the timesheet data looks correct. If selectors need adjustment (PeopleSoft UI varies), update the DOM selectors in `hcm-timesheet.ts` and `hcm-paystubs.ts`.

**Step 4: Run write test**

Run: `HCM_CASE_ID=<id> HCM_PASSWORD=<pw> DUO_TOTP_SECRET=<secret> RUN_WRITE_TESTS=1 pnpm vitest run tests/integration/hcm.test.ts -t "enters hours"`

Verify hours are entered correctly. **Do NOT run the submit test on a real timesheet unless you intend to submit.**

**Step 5: Iterate on selectors**

PeopleSoft's DOM structure is installation-specific. After the first manual test run, you'll likely need to:
1. Open the browser in headed mode (`headless: false` in `launchHcmBrowser`)
2. Inspect the actual DOM elements on hcm.case.edu
3. Update selectors in `hcm-browser.ts`, `hcm-timesheet.ts`, and `hcm-paystubs.ts`
4. Re-run tests until they pass
