# Cronometer Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full read/write Cronometer integration using hybrid Playwright login + direct HTTP API calls.

**Architecture:** Playwright handles login and GWT magic value discovery, then all subsequent calls use direct HTTP — CSV export API for reads, GWT RPC for writes. Same 3-layer pattern as Factor75 (client manager, auth tool, feature tools).

**Tech Stack:** TypeScript, Playwright, `@sinclair/typebox`, node `fetch`, CSV parsing

---

### Task 1: Add Cronometer config fields

**Files:**
- Modify: `src/types/plugin-config.ts`

**Step 1: Add Cronometer config fields to PluginConfig**

Add these 3 fields after the existing `factor75_password` field:

```typescript
  cronometer_tokens_path?: string;
  cronometer_email?: string;
  cronometer_password?: string;
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation, no errors.

**Step 3: Commit**

```bash
git add src/types/plugin-config.ts
git commit -m "feat(cronometer): add config fields to PluginConfig"
```

---

### Task 2: Create Cronometer client manager

**Files:**
- Create: `src/auth/cronometer-client-manager.ts`

**Step 1: Write the client manager**

This manages session persistence, export API calls, and GWT RPC calls. Pattern mirrors `Factor75ClientManager`.

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface CronometerSession {
  sesnonce: string;
  user_id: string;
  auth_token: string; // for export API
  gwt_permutation: string;
  gwt_header: string;
  gwt_content_type: string; // "text/x-gwt-rpc; charset=UTF-8"
  gwt_module_base: string; // "https://cronometer.com/cronometer/"
  all_cookies: Record<string, string>;
  authenticated_at: number; // Unix timestamp (ms)
}

interface CronometerSessionFile {
  [account: string]: CronometerSession;
}

const CRONOMETER_BASE = "https://cronometer.com";

export class CronometerClientManager {
  constructor(private tokensPath: string) {}

  private load(): CronometerSessionFile {
    if (!existsSync(this.tokensPath)) return {};
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as CronometerSessionFile;
    } catch {
      return {};
    }
  }

  private save(data: CronometerSessionFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setCredentials(account: string, session: CronometerSession): void {
    const data = this.load();
    data[account] = session;
    this.save(data);
  }

  getCredentials(account: string): CronometerSession | null {
    return this.load()[account] ?? null;
  }

  hasCredentials(account: string): boolean {
    return this.getCredentials(account) !== null;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  private getCookieHeader(session: CronometerSession): string {
    return Object.entries(session.all_cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  /**
   * GET https://cronometer.com/export with the given generate type and date range.
   * Returns raw CSV string.
   */
  async export(
    account: string,
    generate: "dailySummary" | "servings" | "exercises" | "biometrics" | "notes",
    start: string, // YYYY-MM-DD
    end: string,   // YYYY-MM-DD
  ): Promise<string> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const params = new URLSearchParams({
      nonce: session.auth_token,
      generate,
      start,
      end,
    });

    const resp = await fetch(`${CRONOMETER_BASE}/export?${params}`, {
      method: "GET",
      headers: {
        Cookie: this.getCookieHeader(session),
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Cronometer session expired. Call cronometer_auth_setup to re-authenticate.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Cronometer export error: ${resp.status} — ${text.slice(0, 500)}`);
    }

    return resp.text();
  }

  /**
   * POST a GWT RPC call to https://cronometer.com/cronometer/app.
   * Returns the raw response text for the caller to parse.
   */
  async gwtCall(account: string, body: string): Promise<string> {
    const session = this.getCredentials(account);
    if (!session) throw new Error("No credentials for account: " + account);

    const resp = await fetch(`${CRONOMETER_BASE}/cronometer/app`, {
      method: "POST",
      headers: {
        "Content-Type": session.gwt_content_type,
        "X-GWT-Module-Base": session.gwt_module_base,
        "X-GWT-Permutation": session.gwt_permutation,
        Cookie: this.getCookieHeader(session),
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body,
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new Error("Cronometer session expired. Call cronometer_auth_setup to re-authenticate.");
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Cronometer GWT error: ${resp.status} — ${text.slice(0, 500)}`);
    }

    return resp.text();
  }
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/auth/cronometer-client-manager.ts
git commit -m "feat(cronometer): add client manager with export + GWT helpers"
```

---

### Task 3: Create shared utilities

**Files:**
- Create: `src/tools/cronometer-utils.ts`

**Step 1: Write shared helpers for JSON results, auth check, and CSV parsing**

```typescript
/**
 * Shared helpers for Cronometer tools.
 */

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
  action: "Call cronometer_auth_setup to authenticate with Cronometer first.",
};

/**
 * Parse CSV text into an array of objects.
 * First line is headers, subsequent lines are data.
 * Handles quoted fields with commas inside them.
 */
export function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const results: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    results.push(row);
  }

  return results;
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/** Parse a float from a CSV value, returning 0 for empty strings. */
export function parseFloat(val: string): number {
  if (!val || val.trim() === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** Format a serving record from parsed CSV row into a clean object. */
export function formatServing(row: Record<string, string>): Record<string, unknown> {
  return {
    date: row["Day"] ?? row["Date"] ?? "",
    time: row["Time"] ?? "",
    group: row["Group"] ?? row["Meal"] ?? "",
    food_name: row["Food Name"] ?? row["Name"] ?? "",
    quantity: row["Amount"] ?? row["Quantity"] ?? "",
    unit: row["Unit"] ?? "",
    calories: parseFloat(row["Energy (kcal)"] ?? row["Calories"] ?? "0"),
    protein_g: parseFloat(row["Protein (g)"] ?? "0"),
    fat_g: parseFloat(row["Fat (g)"] ?? "0"),
    carbs_g: parseFloat(row["Carbs (g)"] ?? "0"),
    fiber_g: parseFloat(row["Fiber (g)"] ?? "0"),
    sugar_g: parseFloat(row["Sugars (g)"] ?? "0"),
    sodium_mg: parseFloat(row["Sodium (mg)"] ?? "0"),
    cholesterol_mg: parseFloat(row["Cholesterol (mg)"] ?? "0"),
    category: row["Category"] ?? "",
  };
}

/** Format a daily nutrition summary from parsed CSV row. */
export function formatDailySummary(row: Record<string, string>): Record<string, unknown> {
  // Return all numeric fields as numbers, keep date as string
  const result: Record<string, unknown> = { date: row["Date"] ?? row["Day"] ?? "" };
  for (const [key, val] of Object.entries(row)) {
    if (key === "Date" || key === "Day") continue;
    result[key] = parseFloat(val);
  }
  return result;
}

/** Format an exercise record from parsed CSV row. */
export function formatExercise(row: Record<string, string>): Record<string, unknown> {
  return {
    date: row["Day"] ?? row["Date"] ?? "",
    time: row["Time"] ?? "",
    exercise: row["Exercise Name"] ?? row["Exercise"] ?? "",
    minutes: parseFloat(row["Minutes"] ?? "0"),
    calories_burned: parseFloat(row["Calories Burned"] ?? "0"),
    group: row["Group"] ?? "",
  };
}

/** Format a biometric record from parsed CSV row. */
export function formatBiometric(row: Record<string, string>): Record<string, unknown> {
  return {
    date: row["Day"] ?? row["Date"] ?? "",
    time: row["Time"] ?? "",
    metric: row["Metric"] ?? row["Name"] ?? "",
    unit: row["Unit"] ?? "",
    amount: parseFloat(row["Amount"] ?? row["Value"] ?? "0"),
  };
}

/** Format a note record from parsed CSV row. */
export function formatNote(row: Record<string, string>): Record<string, unknown> {
  return {
    date: row["Day"] ?? row["Date"] ?? "",
    note: row["Note"] ?? row["Notes"] ?? "",
  };
}

/** Get today's date in YYYY-MM-DD format. */
export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

/** Get date N days ago in YYYY-MM-DD format. */
export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/tools/cronometer-utils.ts
git commit -m "feat(cronometer): add shared utils — CSV parsing, formatters, helpers"
```

---

### Task 4: Create Cronometer auth tool

**Files:**
- Create: `src/tools/cronometer-auth-tool.ts`

**Step 1: Write the Playwright login flow**

The auth tool:
1. Opens cronometer.com/login/
2. Extracts CSRF token from the page
3. Intercepts GWT requests to discover permutation/header values
4. Fills credentials and submits
5. Captures sesnonce cookie
6. Calls GWT authenticate + generateAuthToken via direct HTTP
7. Stores the full session

```typescript
import { Type } from "@sinclair/typebox";
import { chromium } from "playwright";
import type { CronometerClientManager, CronometerSession } from "../auth/cronometer-client-manager.js";
import type { PluginConfig } from "../types/plugin-config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCronometerAuthTool(
  manager: CronometerClientManager,
  config: PluginConfig,
): any {
  return {
    name: "cronometer_auth_setup",
    label: "Cronometer Auth Setup",
    description:
      "Authenticate with Cronometer (cronometer.com). Logs in via browser automation, captures session tokens and GWT values, then validates. Reads cronometer_email and cronometer_password from plugin config — just call with no arguments. Do NOT ask the user for credentials.",
    parameters: Type.Object({
      email: Type.Optional(
        Type.String({
          description: "Override for Cronometer email. Usually omitted — uses pre-configured value.",
        }),
      ),
      password: Type.Optional(
        Type.String({
          description: "Override for Cronometer password. Usually omitted — uses pre-configured value.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'personal'). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { email?: string; password?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const resolvedEmail = params.email ?? config.cronometer_email;
      const resolvedPassword = params.password ?? config.cronometer_password;

      if (!resolvedEmail || !resolvedPassword) {
        return jsonResult({
          status: "error",
          error: "No Cronometer credentials configured.",
          hint: 'Run: openclaw config set plugins.entries.omniclaw.config.cronometer_email "you@example.com" and openclaw config set plugins.entries.omniclaw.config.cronometer_password "yourpass"',
        });
      }

      try {
        const session = await runCronometerLoginFlow(resolvedEmail, resolvedPassword);
        manager.setCredentials(account, session);

        return jsonResult({
          status: "authenticated",
          account,
          user_id: session.user_id,
          note: "Session saved. All Cronometer tools are now available.",
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
          hint: 'Show the user the exact error. If credentials need updating, direct them to run: openclaw config set plugins.entries.omniclaw.config.cronometer_password "new_password"',
        });
      }
    },
  };
}

async function runCronometerLoginFlow(
  email: string,
  password: string,
): Promise<CronometerSession> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "en-US",
    timezoneId: "America/New_York",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Discovered GWT values — populated by intercepting outgoing requests
  let gwtPermutation = "";
  let gwtModuleBase = "";
  let gwtHeader = "";
  const gwtContentType = "text/x-gwt-rpc; charset=UTF-8";

  // Intercept outgoing GWT requests to discover magic values
  page.on("request", (request) => {
    const headers = request.headers();
    if (headers["x-gwt-permutation"] && !gwtPermutation) {
      gwtPermutation = headers["x-gwt-permutation"];
      gwtModuleBase = headers["x-gwt-module-base"] ?? "https://cronometer.com/cronometer/";
      console.log(`[cronometer] Discovered GWT permutation: ${gwtPermutation}`);
    }
    // Also try to extract the GWT header from request bodies
    if (request.url().includes("/cronometer/app")) {
      try {
        const body = request.postData();
        if (body) {
          // GWT body format: 7|0|N|moduleBase|HEADER|...
          const parts = body.split("|");
          if (parts.length >= 5 && parts[3]?.includes("cronometer")) {
            gwtHeader = parts[4];
          }
        }
      } catch {
        // ignore
      }
    }
  });

  try {
    console.log("[cronometer] Navigating to Cronometer login...");
    try {
      await page.goto("https://cronometer.com/login/", {
        waitUntil: "commit",
        timeout: 30000,
      });
    } catch (navErr) {
      console.log(`[cronometer] Navigation note: ${navErr instanceof Error ? navErr.message : navErr}`);
    }

    // Wait for login form
    console.log("[cronometer] Waiting for login form...");
    await page.waitForSelector(
      'input[name="username"], input[type="email"], input#username',
      { timeout: 45000 },
    );
    console.log("[cronometer] Login form found.");

    // Extract CSRF token
    let anticsrf = "";
    try {
      anticsrf = await page.evaluate(() => {
        const input = document.querySelector('input[name="anticsrf"]') as HTMLInputElement | null;
        return input?.value ?? "";
      });
      if (anticsrf) {
        console.log(`[cronometer] CSRF token captured: ${anticsrf.slice(0, 8)}...`);
      }
    } catch {
      console.log("[cronometer] No CSRF token found on page.");
    }

    // Dismiss cookie consent if present
    try {
      const cookieBtn = page.locator(
        'button:has-text("Accept All"), button:has-text("Accept"), button:has-text("Allow"), button:has-text("Got it")',
      );
      await cookieBtn.first().click({ timeout: 3000 });
      console.log("[cronometer] Cookie consent dismissed.");
      await page.waitForTimeout(500);
    } catch {
      // No cookie banner
    }

    // Fill credentials
    console.log("[cronometer] Filling credentials...");
    const emailInput = page.locator(
      'input[name="username"], input[type="email"], input#username',
    ).first();
    const passwordInput = page.locator(
      'input[name="password"], input[type="password"], input#password',
    ).first();

    await emailInput.click();
    await emailInput.pressSequentially(email, { delay: 30 });
    await passwordInput.click();
    await passwordInput.pressSequentially(password, { delay: 30 });
    await page.waitForTimeout(500);

    // Submit
    try {
      const submitBtn = page.locator(
        'button[type="submit"], input[type="submit"], button:has-text("Log In"), button:has-text("Sign In")',
      ).first();
      await submitBtn.click({ timeout: 3000 });
    } catch {
      await page.keyboard.press("Enter");
    }
    console.log("[cronometer] Credentials submitted.");

    // Wait for redirect to the app (post-login URL contains /cronometer or /#)
    console.log("[cronometer] Waiting for post-login redirect...");
    let loggedIn = false;
    for (let i = 0; i < 60; i++) {
      const url = page.url();
      if (url.includes("cronometer.com/#") || url.includes("/cronometer/#") || url.includes("/food-diary")) {
        loggedIn = true;
        break;
      }
      // Check for error messages
      try {
        const errorText = await page.evaluate(() => {
          const el = document.querySelector(".error-message, .alert-danger, .login-error");
          return el?.textContent?.trim() ?? "";
        });
        if (errorText) {
          throw new Error(`Cronometer login failed: ${errorText}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("login failed")) throw e;
      }
      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error("Cronometer login timed out. Check credentials or try again.");
    }
    console.log("[cronometer] Login successful. Extracting session...");

    // Wait a moment for GWT app to load and make requests (so we capture GWT values)
    await page.waitForTimeout(3000);

    // Extract cookies
    const cookies = await context.cookies();
    const allCookies: Record<string, string> = {};
    let sesnonce = "";
    for (const c of cookies) {
      allCookies[c.name] = c.value;
      if (c.name === "sesnonce") sesnonce = c.value;
    }

    if (!sesnonce) {
      throw new Error("Failed to capture sesnonce cookie after login.");
    }
    console.log(`[cronometer] sesnonce captured: ${sesnonce.slice(0, 8)}...`);

    // If GWT values weren't captured from intercepted requests, use known defaults
    if (!gwtPermutation) {
      console.log("[cronometer] GWT values not intercepted, using known defaults...");
      gwtPermutation = "7B121DC5483BF272B1BC1916DA9FA963";
      gwtModuleBase = "https://cronometer.com/cronometer/";
    }
    if (!gwtHeader) {
      gwtHeader = "2D6A926E3729946302DC68073CB0D550";
    }

    await browser.close();

    // Now do GWT authenticate + generateAuthToken via direct HTTP
    const cookieHeader = Object.entries(allCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const gwtHeaders = {
      "Content-Type": gwtContentType,
      "X-GWT-Module-Base": gwtModuleBase,
      "X-GWT-Permutation": gwtPermutation,
      Cookie: cookieHeader,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };

    // GWT authenticate — returns user ID
    const authBody = `7|0|5|${gwtModuleBase}|${gwtHeader}|com.cronometer.client.CronometerService|authenticate|java.lang.Integer/3438268394|1|2|3|4|1|5|5|-300|`;

    const authResp = await fetch("https://cronometer.com/cronometer/app", {
      method: "POST",
      headers: gwtHeaders,
      body: authBody,
    });
    const authText = await authResp.text();
    console.log(`[cronometer] GWT authenticate response: ${authText.slice(0, 100)}`);

    // Extract user ID from response: //OK[userId,...]
    const userIdMatch = authText.match(/OK\[(\d+),/);
    const userId = userIdMatch?.[1] ?? "";

    if (!userId) {
      // Authentication may have updated the sesnonce cookie
      console.log("[cronometer] Could not extract user ID from GWT auth response, continuing...");
    }

    // Extract updated sesnonce from auth response cookies if present
    const authSetCookie = authResp.headers.get("set-cookie");
    if (authSetCookie) {
      const nMatch = authSetCookie.match(/sesnonce=([^;]+)/);
      if (nMatch) {
        sesnonce = nMatch[1];
        allCookies["sesnonce"] = sesnonce;
      }
    }

    // GWT generateAuthToken — returns the nonce for the export API
    const genTokenBody = `7|0|7|${gwtModuleBase}|${gwtHeader}|com.cronometer.client.CronometerService|generateAuthToken|java.lang.String/2004016611|I|${sesnonce}|1|2|3|4|2|5|6|7|${userId}|`;

    const tokenResp = await fetch("https://cronometer.com/cronometer/app", {
      method: "POST",
      headers: {
        ...gwtHeaders,
        Cookie: Object.entries(allCookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
      body: genTokenBody,
    });
    const tokenText = await tokenResp.text();
    console.log(`[cronometer] GWT generateAuthToken response: ${tokenText.slice(0, 100)}`);

    // Extract auth token: //OK["TOKEN"]
    const tokenMatch = tokenText.match(/"([^"]+)"/);
    const authToken = tokenMatch?.[1] ?? "";

    if (!authToken) {
      console.log("[cronometer] Warning: could not extract auth token. Export tools may not work.");
    }

    return {
      sesnonce,
      user_id: userId,
      auth_token: authToken,
      gwt_permutation: gwtPermutation,
      gwt_header: gwtHeader,
      gwt_content_type: gwtContentType,
      gwt_module_base: gwtModuleBase,
      all_cookies: allCookies,
      authenticated_at: Date.now(),
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/tools/cronometer-auth-tool.ts
git commit -m "feat(cronometer): add Playwright auth tool with GWT value discovery"
```

---

### Task 5: Create food diary tool

**Files:**
- Create: `src/tools/cronometer-diary.ts`

**Step 1: Write the food diary export tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { CronometerClientManager } from "../auth/cronometer-client-manager.js";
import { jsonResult, AUTH_REQUIRED, parseCsv, formatServing, todayStr, daysAgoStr } from "./cronometer-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCronometerDiaryTool(manager: CronometerClientManager): any {
  return {
    name: "cronometer_diary",
    label: "Cronometer Diary",
    description:
      "Get the food diary (servings log) from Cronometer for a date range. Returns food items logged with calories, macros, and key nutrients. Defaults to the last 7 days.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to 7 days ago." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date (YYYY-MM-DD). Defaults to today." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Cronometer account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: string; end?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const start = params.start ?? daysAgoStr(7);
        const end = params.end ?? todayStr();
        const csv = await manager.export(account, "servings", start, end);
        const rows = parseCsv(csv);
        const servings = rows.map(formatServing);

        return jsonResult({
          start,
          end,
          count: servings.length,
          servings,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Commit**

```bash
git add src/tools/cronometer-diary.ts
git commit -m "feat(cronometer): add food diary export tool"
```

---

### Task 6: Create nutrition summary tool

**Files:**
- Create: `src/tools/cronometer-nutrition.ts`

**Step 1: Write the daily nutrition summary tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { CronometerClientManager } from "../auth/cronometer-client-manager.js";
import { jsonResult, AUTH_REQUIRED, parseCsv, formatDailySummary, todayStr, daysAgoStr } from "./cronometer-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCronometerNutritionTool(manager: CronometerClientManager): any {
  return {
    name: "cronometer_nutrition_summary",
    label: "Cronometer Nutrition Summary",
    description:
      "Get daily nutrition totals from Cronometer for a date range. Tracks up to 84 nutrients including macros, vitamins, minerals, and amino acids. Defaults to the last 7 days.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to 7 days ago." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date (YYYY-MM-DD). Defaults to today." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Cronometer account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: string; end?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const start = params.start ?? daysAgoStr(7);
        const end = params.end ?? todayStr();
        const csv = await manager.export(account, "dailySummary", start, end);
        const rows = parseCsv(csv);
        const summaries = rows.map(formatDailySummary);

        return jsonResult({
          start,
          end,
          days: summaries.length,
          summaries,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify build**

Run: `pnpm build`

**Step 3: Commit**

```bash
git add src/tools/cronometer-nutrition.ts
git commit -m "feat(cronometer): add daily nutrition summary tool"
```

---

### Task 7: Create exercises, biometrics, and notes tools

**Files:**
- Create: `src/tools/cronometer-exercises.ts`
- Create: `src/tools/cronometer-biometrics.ts`
- Create: `src/tools/cronometer-notes.ts`

**Step 1: Write the exercises tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { CronometerClientManager } from "../auth/cronometer-client-manager.js";
import { jsonResult, AUTH_REQUIRED, parseCsv, formatExercise, todayStr, daysAgoStr } from "./cronometer-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCronometerExercisesTool(manager: CronometerClientManager): any {
  return {
    name: "cronometer_exercises",
    label: "Cronometer Exercises",
    description:
      "Get the exercise log from Cronometer for a date range. Returns exercises with duration and calories burned. Defaults to the last 7 days.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to 7 days ago." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date (YYYY-MM-DD). Defaults to today." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Cronometer account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: string; end?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const start = params.start ?? daysAgoStr(7);
        const end = params.end ?? todayStr();
        const csv = await manager.export(account, "exercises", start, end);
        const rows = parseCsv(csv);
        const exercises = rows.map(formatExercise);

        return jsonResult({ start, end, count: exercises.length, exercises });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Write the biometrics tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { CronometerClientManager } from "../auth/cronometer-client-manager.js";
import { jsonResult, AUTH_REQUIRED, parseCsv, formatBiometric, todayStr, daysAgoStr } from "./cronometer-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCronometerBiometricsTool(manager: CronometerClientManager): any {
  return {
    name: "cronometer_biometrics",
    label: "Cronometer Biometrics",
    description:
      "Get biometric measurements from Cronometer for a date range. Returns measurements like weight, blood pressure, body fat %, etc. Defaults to the last 30 days.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to 30 days ago." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date (YYYY-MM-DD). Defaults to today." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Cronometer account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: string; end?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const start = params.start ?? daysAgoStr(30);
        const end = params.end ?? todayStr();
        const csv = await manager.export(account, "biometrics", start, end);
        const rows = parseCsv(csv);
        const biometrics = rows.map(formatBiometric);

        return jsonResult({ start, end, count: biometrics.length, biometrics });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 3: Write the notes tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { CronometerClientManager } from "../auth/cronometer-client-manager.js";
import { jsonResult, AUTH_REQUIRED, parseCsv, formatNote, todayStr, daysAgoStr } from "./cronometer-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCronometerNotesTool(manager: CronometerClientManager): any {
  return {
    name: "cronometer_notes",
    label: "Cronometer Notes",
    description:
      "Get daily notes from Cronometer for a date range. Returns notes attached to each day. Defaults to the last 30 days.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to 30 days ago." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date (YYYY-MM-DD). Defaults to today." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Cronometer account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: string; end?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const start = params.start ?? daysAgoStr(30);
        const end = params.end ?? todayStr();
        const csv = await manager.export(account, "notes", start, end);
        const rows = parseCsv(csv);
        const notes = rows.map(formatNote);

        return jsonResult({ start, end, count: notes.length, notes });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 4: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 5: Commit**

```bash
git add src/tools/cronometer-exercises.ts src/tools/cronometer-biometrics.ts src/tools/cronometer-notes.ts
git commit -m "feat(cronometer): add exercises, biometrics, and notes export tools"
```

---

### Task 8: Register all tools in plugin.ts

**Files:**
- Modify: `src/plugin.ts`

**Step 1: Add imports**

After the existing Factor75 imports (around line ~130), add:

```typescript
import { CronometerClientManager } from "./auth/cronometer-client-manager.js";
import { createCronometerAuthTool } from "./tools/cronometer-auth-tool.js";
import { createCronometerDiaryTool } from "./tools/cronometer-diary.js";
import { createCronometerNutritionTool } from "./tools/cronometer-nutrition.js";
import { createCronometerExercisesTool } from "./tools/cronometer-exercises.js";
import { createCronometerBiometricsTool } from "./tools/cronometer-biometrics.js";
import { createCronometerNotesTool } from "./tools/cronometer-notes.js";
```

**Step 2: Add registration block**

After the Factor75 registration block (after `reg(createFactor75AccountTool(factor75Manager));`), add:

```typescript
  // Cronometer tools — register unconditionally, no Google credentials required
  const cronometerTokensPath =
    config.cronometer_tokens_path ??
    path.join(
      config.tokens_path ? path.dirname(config.tokens_path) : defaultTokensDir,
      "omniclaw-cronometer-tokens.json",
    );

  const cronometerManager = new CronometerClientManager(cronometerTokensPath);

  reg(createCronometerAuthTool(cronometerManager, config));
  reg(createCronometerDiaryTool(cronometerManager));
  reg(createCronometerNutritionTool(cronometerManager));
  reg(createCronometerExercisesTool(cronometerManager));
  reg(createCronometerBiometricsTool(cronometerManager));
  reg(createCronometerNotesTool(cronometerManager));
```

**Step 3: Verify build**

Run: `pnpm build`
Expected: Clean compilation.

**Step 4: Commit**

```bash
git add src/plugin.ts
git commit -m "feat(cronometer): register auth + 5 read tools in plugin"
```

---

### Task 9: Write integration tests

**Files:**
- Create: `tests/integration/cronometer.test.ts`

**Step 1: Write the integration test suite**

```typescript
/**
 * Integration tests — hit the real Cronometer API.
 *
 * Re-authenticates in beforeAll via cronometer_auth_setup (Playwright browser login).
 * Credentials are read from the openclaw config file (~/.openclaw/openclaw.json),
 * with env var overrides:
 *   CRONOMETER_EMAIL       Cronometer account email
 *   CRONOMETER_PASSWORD    Cronometer account password
 *
 * Optional env vars:
 *   CRONOMETER_ACCOUNT     Token store account name (default: "default")
 *
 * Run:
 *   CRONOMETER_EMAIL="..." CRONOMETER_PASSWORD="..." pnpm vitest run tests/integration/cronometer.test.ts
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { CronometerClientManager } from "../../src/auth/cronometer-client-manager.js";
import { createCronometerAuthTool } from "../../src/tools/cronometer-auth-tool.js";
import { createCronometerDiaryTool } from "../../src/tools/cronometer-diary.js";
import { createCronometerNutritionTool } from "../../src/tools/cronometer-nutrition.js";
import { createCronometerExercisesTool } from "../../src/tools/cronometer-exercises.js";
import { createCronometerBiometricsTool } from "../../src/tools/cronometer-biometrics.js";
import { createCronometerNotesTool } from "../../src/tools/cronometer-notes.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function loadOpenclawPluginConfig(): Record<string, string> {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) return {};
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return raw?.plugins?.entries?.omniclaw?.config ?? {};
  } catch {
    return {};
  }
}

const oclConfig = loadOpenclawPluginConfig();

const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-cronometer-tokens.json");
const ACCOUNT = process.env.CRONOMETER_ACCOUNT ?? "default";

const CRONOMETER_EMAIL = process.env.CRONOMETER_EMAIL || oclConfig.cronometer_email || "";
const CRONOMETER_PASSWORD = process.env.CRONOMETER_PASSWORD || oclConfig.cronometer_password || "";

const authCredentialsAvailable = CRONOMETER_EMAIL !== "" && CRONOMETER_PASSWORD !== "";

if (!authCredentialsAvailable) {
  console.warn(
    "\n[integration] Skipping Cronometer tests: auth credentials not found in " +
      "~/.openclaw/openclaw.json or env vars.\n",
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResult(result: any): any {
  const text = result?.content?.[0]?.text;
  return text ? JSON.parse(text) : result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe.skipIf(!authCredentialsAvailable)("Cronometer integration", () => {
  let manager: CronometerClientManager;

  beforeAll(async () => {
    manager = new CronometerClientManager(TOKENS_PATH);

    // Authenticate if no existing valid session
    if (!manager.hasCredentials(ACCOUNT)) {
      const authTool = createCronometerAuthTool(manager, {
        client_secret_path: "",
        cronometer_email: CRONOMETER_EMAIL,
        cronometer_password: CRONOMETER_PASSWORD,
      });
      const result = parseResult(await authTool.execute("test", { account: ACCOUNT }));
      expect(result.status).toBe("authenticated");
      console.log("[cronometer] Authenticated as user:", result.user_id);
    } else {
      console.log("[cronometer] Using existing session for account:", ACCOUNT);
    }
  }, 120_000);

  // ---- Diary ----
  it("cronometer_diary — lists food servings", async () => {
    const tool = createCronometerDiaryTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.servings).toBeDefined();
    expect(Array.isArray(result.servings)).toBe(true);
    console.log(`[cronometer] Diary: ${result.count} servings in last 7 days`);
  }, 30_000);

  // ---- Nutrition Summary ----
  it("cronometer_nutrition_summary — daily totals", async () => {
    const tool = createCronometerNutritionTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.summaries).toBeDefined();
    expect(Array.isArray(result.summaries)).toBe(true);
    console.log(`[cronometer] Nutrition: ${result.days} days`);
  }, 30_000);

  // ---- Exercises ----
  it("cronometer_exercises — exercise log", async () => {
    const tool = createCronometerExercisesTool(manager);
    const result = parseResult(await tool.execute("test", { account: ACCOUNT }));

    expect(result.error).toBeUndefined();
    expect(result.exercises).toBeDefined();
    expect(Array.isArray(result.exercises)).toBe(true);
    console.log(`[cronometer] Exercises: ${result.count} entries`);
  }, 30_000);

  // ---- Biometrics ----
  it("cronometer_biometrics — biometric measurements", async () => {
    const tool = createCronometerBiometricsTool(manager);
    const result = parseResult(
      await tool.execute("test", { start: "2025-01-01", account: ACCOUNT }),
    );

    expect(result.error).toBeUndefined();
    expect(result.biometrics).toBeDefined();
    expect(Array.isArray(result.biometrics)).toBe(true);
    console.log(`[cronometer] Biometrics: ${result.count} measurements`);
  }, 30_000);

  // ---- Notes ----
  it("cronometer_notes — daily notes", async () => {
    const tool = createCronometerNotesTool(manager);
    const result = parseResult(
      await tool.execute("test", { start: "2025-01-01", account: ACCOUNT }),
    );

    expect(result.error).toBeUndefined();
    expect(result.notes).toBeDefined();
    expect(Array.isArray(result.notes)).toBe(true);
    console.log(`[cronometer] Notes: ${result.count} entries`);
  }, 30_000);
});
```

**Step 2: Verify build (test file doesn't need to compile for build, but check)**

Run: `pnpm build`
Expected: Clean compilation.

**Step 3: Run the tests**

Run: `CRONOMETER_EMAIL="<email>" CRONOMETER_PASSWORD="<password>" pnpm vitest run tests/integration/cronometer.test.ts`
Expected: All tests pass. Auth takes ~30-60s (Playwright), then each read test ~1-5s.

**Step 4: Commit**

```bash
git add tests/integration/cronometer.test.ts
git commit -m "test(cronometer): add integration tests for auth + 5 read tools"
```

---

### Task 10: Write documentation and skill file

**Files:**
- Create: `docs/cronometer.md`
- Create: `skills/cronometer.SKILL.md`

**Step 1: Write technical docs**

```markdown
# Cronometer Integration

6 tools for tracking nutrition, exercise, biometrics, and notes via Cronometer.

## Setup

Cronometer uses browser-based authentication via Playwright for the initial login. After authentication, all API calls use direct HTTP to Cronometer's export API (~100ms per call). Session tokens do not have a known expiry — re-authenticate if calls start failing.

### Step 1: Install Browser

\`\`\`bash
npx playwright install chromium
\`\`\`

### Step 2: Configure Credentials (Optional)

Save your Cronometer credentials so authentication is automatic:

\`\`\`bash
openclaw config set plugins.entries.omniclaw.config.cronometer_email "your_email@example.com"
openclaw config set plugins.entries.omniclaw.config.cronometer_password "your_password"
\`\`\`

### Step 3: Authenticate

Ask your agent:
> "Set up Cronometer"

It will call `cronometer_auth_setup`, which opens a Chromium browser to Cronometer's login page. Credentials are auto-filled if configured. Once logged in, session tokens and GWT values are captured for subsequent direct HTTP calls.

## Tools

| Tool | Description |
|------|-------------|
| `cronometer_auth_setup` | Authenticate via browser login |
| `cronometer_diary` | Food diary (servings) for a date range |
| `cronometer_nutrition_summary` | Daily nutrition totals (up to 84 nutrients) |
| `cronometer_exercises` | Exercise log for a date range |
| `cronometer_biometrics` | Biometric measurements (weight, BP, etc.) |
| `cronometer_notes` | Daily notes for a date range |

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `cronometer_tokens_path` | No | `~/.openclaw/omniclaw-cronometer-tokens.json` | Where Cronometer session tokens are stored |
| `cronometer_email` | No | — | Cronometer account email for automatic login |
| `cronometer_password` | No | — | Cronometer account password for automatic login |

## Architecture

Cronometer uses a GWT (Google Web Toolkit) backend with no public API. This integration uses a hybrid approach:

- **Auth**: Playwright opens cronometer.com/login, captures session cookies and GWT magic values
- **Read**: Direct HTTP to `/export` endpoint with CSV response parsing
- **Write (future)**: GWT RPC calls to `/cronometer/app`

## Usage Examples

> "What did I eat today on Cronometer?"
> "Show my Cronometer nutrition for this week"
> "How many calories did I burn exercising this month?"
> "What's my weight trend on Cronometer?"
> "Show my Cronometer notes from January"
```

**Step 2: Write user-facing skill file**

```yaml
---
name: cronometer
description: Cronometer nutrition tracking — view food diary, nutrition, exercise, biometrics, and notes.
metadata: {"openclaw": {"emoji": "🥦"}}
---

# Cronometer

Track nutrition, exercise, biometrics, and notes on Cronometer (cronometer.com).

## First-Time Setup

Cronometer uses browser-based authentication via Playwright. After the initial login, all requests use fast direct HTTP.

1. Make sure Playwright browsers are installed: `npx playwright install chromium`
2. Save your Cronometer credentials once:

\`\`\`bash
openclaw config set plugins.entries.omniclaw.config.cronometer_email "your_email@example.com"
openclaw config set plugins.entries.omniclaw.config.cronometer_password "your_password"
\`\`\`

3. Call `cronometer_auth_setup` with no arguments.
4. A browser will open to cronometer.com/login. Credentials are auto-filled if configured.
5. Once login succeeds, session tokens are saved automatically.

## Available Tools

- `cronometer_auth_setup` — Authenticate via browser login
- `cronometer_diary` — Food diary (servings) for a date range
- `cronometer_nutrition_summary` — Daily nutrition totals (84 nutrients)
- `cronometer_exercises` — Exercise log for a date range
- `cronometer_biometrics` — Biometric measurements (weight, BP, body fat, etc.)
- `cronometer_notes` — Daily notes for a date range

## Workflow

1. Call `cronometer_auth_setup` with no arguments — the tool reads credentials from the plugin config automatically. Do NOT ask the user for their email or password.
2. Use `cronometer_diary` to see what was eaten on a given day or date range.
3. Use `cronometer_nutrition_summary` for daily totals of all tracked nutrients.
4. Use `cronometer_exercises` to see the exercise log.
5. Use `cronometer_biometrics` to track weight, blood pressure, and other measurements over time.
6. Use `cronometer_notes` to see daily notes.

## Error Handling

If any tool returns `"error": "auth_required"`, call `cronometer_auth_setup` first.

If a session expires, call `cronometer_auth_setup` again to re-authenticate.
```

**Step 3: Commit**

```bash
git add docs/cronometer.md skills/cronometer.SKILL.md
git commit -m "docs(cronometer): add technical docs and user-facing skill file"
```

---

### Task 11: Update CLAUDE.md integration table

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Move Cronometer from Planned to Done**

In the `## Done` table, add a row:

```
| Cronometer | 6 | `cronometer` | `docs/cronometer.md` | Playwright login + CSV export API |
```

In the `## Planned` table, remove the `| Cronometer | #32 | |` row.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: move Cronometer from planned to done in CLAUDE.md"
```

---

### Task 12 (Phase 2 — future): GWT write tools

> **NOTE:** This task is deferred. Phase 2 write tools (food search, log food, remove food, log exercise, log biometric, log note) require discovering GWT RPC method signatures by intercepting network traffic while using the Cronometer web app. These will be added in a follow-up after Phase 1 is validated.

**Files to create:**
- `src/tools/cronometer-search.ts`
- `src/tools/cronometer-log-food.ts`
- `src/tools/cronometer-remove-food.ts`
- `src/tools/cronometer-log-exercise.ts`
- `src/tools/cronometer-log-biometric.ts`
- `src/tools/cronometer-log-note.ts`

**Approach:** During auth, add a step that navigates through the Cronometer web app (search for a food, check diary page) to capture the GWT method names and parameter formats from intercepted requests. Use those discovered formats to build direct GWT RPC calls.
