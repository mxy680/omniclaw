---
name: new-integration
description: Step-by-step guide for adding a new service integration to the Omniclaw MCP server. Covers Google OAuth, API key/token, and session-cookie auth via Playwright.
metadata: {"openclaw": {"emoji": "🔌"}}
---

# New Integration

Add a new service integration to the Omniclaw MCP server. This skill covers three auth strategies: Google OAuth (Gmail, Calendar, etc.), API key/token (GitHub, Notion, etc.), and session-cookie auth via Playwright (LinkedIn, Instagram, Slack, Canvas — for platforms without official APIs).

## Choose an Auth Strategy

Before starting, pick a service name (short, lowercase, e.g. `slack`, `notion`, `jira`) and choose an auth strategy:

| | Strategy A: Google OAuth | Strategy B: API Key / Token | Strategy C: Session Cookie |
|---|---|---|---|
| **When to use** | Service is a Google API | Service has an official API with token/key auth | No official API, or API is too restrictive |
| **Auth mechanism** | OAuth 2.0 browser redirect | User provides static token/key | Playwright captures browser cookies |
| **Token refresh** | Automatic (refresh token) | N/A (long-lived key) | Manual re-auth (cookies expire) |
| **NPM SDK** | `googleapis` | Varies (`@octokit/rest`, `@notionhq/client`, etc.) | None — raw HTTP with `tls-client` |
| **Existing examples** | Gmail, Calendar, Drive, Docs, Sheets, Slides, YouTube | GitHub | (new — see platform patterns below) |
| **TLS fingerprinting** | Not needed | Not needed | Required for LinkedIn, Instagram, Slack. Not needed for Canvas. |

---

## Strategy A: Google OAuth

For any Google API. Reuses the existing `OAuthClientManager`.

### A1. Add OAuth scope

Edit `src/auth/gmail-auth.ts` → `getAuthUrl()` → add the new scope to the `scope` array.

### A2. Add auth tool factory

Edit `src/tools/gmail-auth-tool.ts` — add a new exported factory alongside the existing ones:

```typescript
export function create{Service}AuthTool(
  clientManager: OAuthClientManager,
  config: PluginConfig,
): any {
  return createAuthTool("{service}", clientManager, config);
}
```

### A3. Create feature tools

Create `src/tools/{service}-{feature}.ts` (one file per logical group):

```typescript
import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("{service}");

export function create{Service}{Action}Tool(clientManager: OAuthClientManager): any {
  return {
    name: "{service}_{action}",
    label: "{Service} {Action}",
    description: "...",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
      // ... service-specific params
    }),
    async execute(_toolCallId: string, params: { account?: string; /* ... */ }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      const client = clientManager.getClient(account);
      const svc = google.{serviceApi}({ version: "v3", auth: client });
      // ... call API
      return jsonResult(result);
    },
  };
}
```

### A4. Register tools

Edit `src/mcp/tool-registry.ts` — add inside the existing `if (config.client_secret_path)` block:

```typescript
add(create{Service}AuthTool(clientManager, config));
add(create{Service}{Action}Tool(clientManager));
```

No changes needed to `plugin-config.ts` or `openclaw.plugin.json` — Google OAuth services reuse `client_secret_path`.

---

## Strategy B: API Key / Token

For services with official APIs and token-based auth (GitHub, Notion, Stripe, etc.).

### B1. Create auth client

Create `src/auth/{service}-client.ts` following the `GitHubClient` pattern (`src/auth/github-client.ts`):

```typescript
import { SomeSDK } from "some-sdk";

export class {Service}Client {
  private client: SomeSDK | null = null;
  private token: string | null = null;

  constructor(token?: string) {
    if (token) {
      this.token = token;
      this.client = new SomeSDK({ auth: token });
    }
  }

  isAuthenticated(): boolean {
    return this.client !== null;
  }

  getClient(): SomeSDK {
    return this.client!;
  }

  setToken(token: string): void {
    this.token = token;
    this.client = new SomeSDK({ auth: token });
  }
}
```

### B2. Create auth setup tool

Create `src/tools/{service}-auth.ts` following `src/tools/github-auth.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { {Service}Client } from "../auth/{service}-client.js";
import { jsonResult } from "./shared.js";

export function create{Service}AuthSetupTool(client: {Service}Client): any {
  return {
    name: "{service}_auth_setup",
    label: "{Service} Auth Setup",
    description: "Validate a {Service} API token and return account info.",
    parameters: Type.Object({
      token: Type.String({ description: "{Service} API token." }),
    }),
    async execute(_toolCallId: string, params: { token: string }) {
      client.setToken(params.token);
      try {
        const me = await client.getClient().users.me();
        return jsonResult({ user: me.name, id: me.id });
      } catch (err: unknown) {
        return jsonResult({
          error: "auth_failed",
          message: err instanceof Error ? err.message : String(err),
          note: "The token may be invalid or lack required permissions.",
        });
      }
    },
  };
}
```

### B3. Create feature tools

Create `src/tools/{service}-{feature}.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { {Service}Client } from "../auth/{service}-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("{service}");

export function create{Service}{Action}Tool(client: {Service}Client): any {
  return {
    name: "{service}_{action}",
    label: "{Service} {Action}",
    description: "...",
    parameters: Type.Object({ /* ... */ }),
    async execute(_toolCallId: string, params: { /* ... */ }) {
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const sdk = client.getClient();
      // ... call API
      return jsonResult(result);
    },
  };
}
```

### B4. Register tools

Edit `src/mcp/tool-registry.ts` — add a new block:

```typescript
// {Service} tools
{
  const {service}Client = new {Service}Client(config.{service}_token);
  add(create{Service}AuthSetupTool({service}Client));
  add(create{Service}{Action}Tool({service}Client));
}
```

### B5. Update plugin config

**`src/types/plugin-config.ts`**:
```typescript
export interface PluginConfig {
  // ... existing fields
  {service}_token?: string;
}
```

**`openclaw.plugin.json`** — add to `configSchema.properties` and `uiHints`:
```json
"{service}_token": {
  "type": "string",
  "description": "{Service} API token. Required for {Service} tools."
}
```
```json
"{service}_token": {
  "label": "{Service} API Token"
}
```

---

## Strategy C: Session Cookie via Playwright

For platforms without official APIs or with restrictive API access. Automates a browser login to capture session cookies, then makes authenticated API requests with TLS fingerprint impersonation.

### C1. Install dependencies

```bash
pnpm add playwright tls-client
```

- `playwright` — browser automation for login flows
- `tls-client` — TLS fingerprint impersonation (Chrome JA3/JA4). Required for LinkedIn, Instagram, Slack. For services that don't check TLS fingerprints (e.g. Canvas), plain `fetch` works.

### C2. SessionStore (shared module — create once)

If `src/auth/session-store.ts` doesn't exist yet, create it. This is a shared module reused by all session-cookie integrations:

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface SessionData {
  cookies: Record<string, string>;
  csrfToken?: string;
  userAgent: string;
  capturedAt: number;
  [key: string]: unknown;  // platform-specific extras
}

interface SessionFile {
  [account: string]: SessionData;
}

export class SessionStore {
  constructor(private sessionsPath: string) {}

  private load(): SessionFile {
    if (!existsSync(this.sessionsPath)) return {};
    try {
      return JSON.parse(readFileSync(this.sessionsPath, "utf-8")) as SessionFile;
    } catch { return {}; }
  }

  private save(data: SessionFile): void {
    const dir = dirname(this.sessionsPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.sessionsPath, JSON.stringify(data, null, 2), "utf-8");
  }

  get(account: string): SessionData | null { return this.load()[account] ?? null; }
  set(account: string, session: SessionData): void { const d = this.load(); d[account] = session; this.save(d); }
  has(account: string): boolean { return this.get(account) !== null; }
  delete(account: string): boolean { const d = this.load(); if (!(account in d)) return false; delete d[account]; this.save(d); return true; }
  list(): string[] { return Object.keys(this.load()); }
}
```

### C3. Create browser auth module

Create `src/auth/{service}-browser-auth.ts` — handles Playwright login flow:

```typescript
import { chromium } from "playwright";
import type { SessionStore, SessionData } from "./session-store.js";

export async function authenticate{Service}(
  sessionStore: SessionStore,
  account: string = "default",
): Promise<SessionData> {
  // Launch visible browser — headless will be blocked by most platforms,
  // and the user needs to handle MFA/CAPTCHA manually
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://{service}.com/login");

  // Wait for user to complete login (including MFA if needed)
  // Adapt the URL pattern or cookie name to your platform
  await page.waitForURL("https://{service}.com/feed/**", { timeout: 120_000 });

  // Capture cookies
  const allCookies = await context.cookies();
  const cookies: Record<string, string> = {};
  for (const c of allCookies) {
    // Keep all cookies, or filter to only relevant ones:
    // if (["{session_cookie}", "{csrf_cookie}"].includes(c.name))
    cookies[c.name] = c.value;
  }

  // Extract CSRF token (platform-specific — from cookie, meta tag, or localStorage)
  const csrfToken = cookies["{csrf_cookie}"] ??
    await page.evaluate(() =>
      document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? ""
    );

  // Capture User-Agent for consistent request headers
  const userAgent = await page.evaluate(() => navigator.userAgent);

  await browser.close();

  const session: SessionData = {
    cookies,
    csrfToken,
    userAgent,
    capturedAt: Date.now(),
  };

  sessionStore.set(account, session);
  return session;
}
```

### C4. Create session client

Create `src/auth/{service}-session-client.ts` — authenticated HTTP client:

```typescript
import { Session as TlsSession } from "tls-client";
import type { SessionStore, SessionData } from "./session-store.js";

export class {Service}SessionClient {
  private session: SessionData | null = null;

  constructor(
    private sessionStore: SessionStore,
    private account: string = "default",
    private baseUrl: string = "https://api.{service}.com",
  ) {
    this.session = sessionStore.get(account) ?? null;
  }

  isAuthenticated(): boolean {
    return this.session !== null;
  }

  reload(account?: string): void {
    const acct = account ?? this.account;
    this.session = this.sessionStore.get(acct) ?? null;
  }

  async request<T = unknown>(opts: {
    method?: string;
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  }): Promise<T> {
    if (!this.session) throw new Error("not_authenticated");

    const cookieHeader = Object.entries(this.session.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const headers: Record<string, string> = {
      "Cookie": cookieHeader,
      "User-Agent": this.session.userAgent,
      ...(this.session.csrfToken ? { "X-CSRFToken": this.session.csrfToken } : {}),
      // Add platform-specific headers here, e.g.:
      // "X-IG-App-ID": "936619743392459",  // Instagram
      // "Csrf-Token": this.session.csrfToken,  // LinkedIn
      // "X-Restli-Protocol-Version": "2.0.0",  // LinkedIn
      ...opts.headers,
    };

    // Use tls-client for TLS fingerprint impersonation
    const tls = new TlsSession({ clientIdentifier: "chrome_120" });
    const res = await tls.execute({
      method: opts.method ?? "GET",
      url: `${this.baseUrl}${opts.path}`,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    // Persist rotated cookies from Set-Cookie response headers
    this.persistRotatedCookies(res);

    if (res.status === 401 || res.status === 403) {
      throw new Error("session_expired");
    }

    return JSON.parse(res.body) as T;
  }

  private persistRotatedCookies(res: { headers: Record<string, string> }): void {
    const setCookies = res.headers["set-cookie"];
    if (!setCookies || !this.session) return;

    let changed = false;
    // set-cookie may be a single string or semicolon-joined
    for (const header of setCookies.split(/,(?=\s*\w+=)/)) {
      const [nameVal] = header.split(";");
      const eqIdx = nameVal.indexOf("=");
      if (eqIdx === -1) continue;
      const name = nameVal.slice(0, eqIdx).trim();
      const value = nameVal.slice(eqIdx + 1).trim();
      if (name && this.session.cookies[name] !== undefined) {
        this.session.cookies[name] = value;
        changed = true;
      }
    }
    if (changed) {
      this.sessionStore.set(this.account, this.session);
    }
  }
}
```

**If TLS fingerprinting is NOT needed** (e.g. Canvas LMS), replace the `tls-client` section with plain `fetch`:

```typescript
const res = await fetch(`${this.baseUrl}${opts.path}`, {
  method: opts.method ?? "GET",
  headers,
  body: opts.body ? JSON.stringify(opts.body) : undefined,
});
```

### C5. Create auth setup tool

Create `src/tools/{service}-auth.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { {Service}SessionClient } from "../auth/{service}-session-client.js";
import type { SessionStore } from "../auth/session-store.js";
import { authenticate{Service} } from "../auth/{service}-browser-auth.js";
import { jsonResult } from "./shared.js";

export function create{Service}AuthSetupTool(
  client: {Service}SessionClient,
  sessionStore: SessionStore,
): any {
  return {
    name: "{service}_auth_setup",
    label: "{Service} Auth Setup",
    description:
      "Authenticate with {Service} by opening a browser window for manual login. Captures session cookies for API access.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      try {
        await authenticate{Service}(sessionStore, account);
        client.reload(account);
        // Validate session with a test API call
        const profile = await client.request({ path: "/me" });
        return jsonResult({ status: "authenticated", account, profile });
      } catch (err: unknown) {
        return jsonResult({
          error: "auth_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
```

### C6. Create feature tools

Same pattern as Strategy B, but catch `session_expired`:

```typescript
import { Type } from "@sinclair/typebox";
import type { {Service}SessionClient } from "../auth/{service}-session-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("{service}");

export function create{Service}{Action}Tool(client: {Service}SessionClient): any {
  return {
    name: "{service}_{action}",
    label: "{Service} {Action}",
    description: "...",
    parameters: Type.Object({ /* ... */ }),
    async execute(_toolCallId: string, params: { /* ... */ }) {
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.request({ path: "/api/endpoint" });
        return jsonResult(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({
            error: "session_expired",
            action: "Session cookies have expired. Call {service}_auth_setup to re-authenticate.",
          });
        }
        return jsonResult({
          error: "request_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
```

### C7. Register tools

Edit `src/mcp/tool-registry.ts`:

```typescript
import * as path from "path";
import * as os from "os";
import { SessionStore } from "../auth/session-store.js";
import { {Service}SessionClient } from "../auth/{service}-session-client.js";
import { create{Service}AuthSetupTool } from "../tools/{service}-auth.js";

// Inside createAllTools():
{
  const sessionsPath = path.join(os.homedir(), ".openclaw", "{service}-sessions.json");
  const sessionStore = new SessionStore(sessionsPath);
  const {service}Client = new {Service}SessionClient(sessionStore);
  add(create{Service}AuthSetupTool({service}Client, sessionStore));
  add(create{Service}{Action}Tool({service}Client));
}
```

### C8. Platform-specific patterns

Reference details for known session-cookie platforms:

| Platform | Key Cookies | CSRF | Required Headers | API Base URL | TLS FP Needed | Notes |
|---|---|---|---|---|---|---|
| **LinkedIn** | `li_at`, `JSESSIONID` | `Csrf-Token` header = `JSESSIONID` value (strip quotes) | `X-Restli-Protocol-Version: 2.0.0`, `Accept: application/vnd.linkedin.normalized+json+2.1` | `https://www.linkedin.com/voyager/api/` | Yes | Voyager API. GraphQL endpoints use literal parens in query string. Response format: `{included: [...], data: {...}}` |
| **Instagram** | `sessionid`, `csrftoken`, `ds_user_id`, `mid`, `ig_did` | `X-CSRFToken` header = `csrftoken` cookie value | `X-IG-App-ID: 936619743392459` | `https://i.instagram.com/api/v1/` (most), `https://www.instagram.com/api/v1/` (search) | Yes | Do NOT set User-Agent explicitly — let `tls-client` handle it. Some endpoints are POST not GET (feed, reels). `csrftoken` rotates every response. |
| **Slack** | `d` cookie (value starts with `xoxd-`) | N/A | `Authorization: Bearer xoxc-...` (token from `localStorage.localConfig_v2`) | `https://slack.com/api/` | Yes | Two tokens required: `xoxc-` (Authorization header) + `d` cookie. All API calls are POST with form-encoded body. `conversations.history` is heavily rate-limited. |
| **Canvas** | `canvas_session`, `_csrf_token`, `log_session_id` | `_csrf_token` cookie + `csrf-token` meta tag in HTML (meta tag is the real authenticity token for POSTs) | Standard | `{CANVAS_BASE_URL}/api/v1/` | No | SSO + Duo MFA browser flow. Uses standard `fetch` (no TLS fingerprint needed). Link-header pagination (RFC 5988). |

### C9. Session-cookie gotchas

| Concern | Detail |
|---|---|
| **TLS fingerprinting** | LinkedIn, Instagram, and Slack check JA3/JA4 fingerprints. Node's native `fetch`/`undici` will be blocked. Use `tls-client`. |
| **CSRF rotation** | Some platforms rotate CSRF tokens every response. Parse `Set-Cookie` headers and update the stored value. |
| **Cookie expiry** | Session cookies last 24h–30d depending on platform. No refresh mechanism — user must re-authenticate. |
| **Rate limiting** | Reverse-engineered APIs may have stricter or unpublished rate limits. Add exponential backoff. |
| **Headless detection** | Most platforms block headless Chromium. Always launch with `headless: false` for login flows. |
| **MFA / CAPTCHA** | Cannot be fully automated. The browser window must be visible for the user to complete manually. Set generous timeouts (120s+). |
| **Set-Cookie parsing** | `tls-client` returns headers as a flat object. If using Node's `fetch`, use `res.headers.getSetCookie()` (Node 20+). |

---

## Integration Tests

Create `tests/integration/{service}.test.ts`. Every tool must have at least one test. Tests use real credentials — no mocks.

### Test structure

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// --- Config (adapt per auth strategy) ---

// Strategy A (Google OAuth):
const CLIENT_SECRET_PATH = process.env.CLIENT_SECRET_PATH ?? join(homedir(), ".openclaw", "client_secret.json");
const TOKENS_PATH = process.env.TOKENS_PATH ?? join(homedir(), ".openclaw", "omniclaw-tokens.json");
const ACCOUNT = process.env.{SERVICE}_ACCOUNT ?? "default";
const credentialsExist = existsSync(CLIENT_SECRET_PATH) && existsSync(TOKENS_PATH);

// Strategy B (Token-based):
// const {SERVICE}_TOKEN = process.env.{SERVICE}_TOKEN ?? "";
// const credentialsExist = {SERVICE}_TOKEN.length > 0;

// Strategy C (Session-cookie):
// const SESSIONS_PATH = process.env.{SERVICE}_SESSIONS_PATH ?? join(homedir(), ".openclaw", "{service}-sessions.json");
// const credentialsExist = existsSync(SESSIONS_PATH);

const RUN_WRITE_TESTS = process.env.RUN_WRITE_TESTS === "1";

// --- Tests ---

describe.skipIf(!credentialsExist)("{Service} integration", { timeout: 30_000 }, () => {
  let client: /* OAuthClientManager | {Service}Client | {Service}SessionClient */;

  beforeAll(() => {
    // Instantiate the client for your auth strategy
  });

  // --- Read-only tests (always run) ---

  describe("{service}_list", () => {
    it("returns an array", async () => {
      const tool = create{Service}ListTool(client);
      const result = await tool.execute("t", { account: ACCOUNT });
      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  describe("{service}_get", () => {
    let firstItemId: string;

    it("fetches an item by ID", async () => {
      // Use an ID captured from the list test
      const tool = create{Service}GetTool(client);
      const result = await tool.execute("t", { id: firstItemId, account: ACCOUNT });
      expect(result.details).toHaveProperty("id");
    });
  });

  // ... one describe block per read tool

  // --- Write tests (opt-in) ---

  describe.skipIf(!RUN_WRITE_TESTS)("write operations (RUN_WRITE_TESTS=1)", () => {
    it("creates, exercises, then deletes a resource", async () => {
      // Create
      const createTool = create{Service}CreateTool(client);
      const created = await createTool.execute("t", {
        name: "[omniclaw integration test] smoke",
        account: ACCOUNT,
      });
      const id = created.details?.id;
      expect(id).toBeTruthy();

      // Exercise (optional — update, get, etc.)

      // Delete (cleanup)
      const deleteTool = create{Service}DeleteTool(client);
      const deleted = await deleteTool.execute("t", { id, account: ACCOUNT });
      expect(deleted.details).toBeTruthy();
    });
  });
});
```

### Key conventions

- `describe.skipIf(!credentialsExist)` — skip entire suite if credentials missing (just warns, doesn't fail CI)
- `{ timeout: 30_000 }` on the top describe block
- Read tests always run; write tests gated by `RUN_WRITE_TESTS=1`
- Write tests always clean up (create → exercise → delete in same `it` block)
- Resource names prefixed with `[omniclaw integration test]`
- Chain tests: early tests capture IDs in module-level `let` variables for later tests
- Temp files go to `tmpdir()`, cleaned in `afterAll`

---

## Web App Smoke Tests

Add the new integration to the web dashboard's test runner so users can click "Test" to verify it works.

### Add test plan

Edit `web/lib/test-plans.ts` — add a new test function and register it:

```typescript
const {service}Test: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // Read-only steps
  const s1 = await runStep("List items", "{service}_list", { max_results: 5 }, execute);
  steps.push(s1);

  const itemId = extractResult(s1.data)?.items?.[0]?.id;
  if (itemId) {
    steps.push(await runStep("Get item details", "{service}_get", { id: itemId }, execute));
  }

  // Write + cleanup steps
  const created = await runStep(
    "Create test item",
    "{service}_create",
    { name: "[omniclaw smoke test] verify" },
    execute,
  );
  steps.push(created);

  const createdId = extractResult(created.data)?.id;
  if (createdId) {
    steps.push(
      await runStep("Delete test item", "{service}_delete", { id: createdId }, execute, true),
    );
  }

  return steps;
};

// Add to SERVICE_TESTS map:
const SERVICE_TESTS: Record<string, ServiceTestFn> = {
  // ... existing entries
  {service}: {service}Test,
};
```

### Add to dashboard

Edit `web/lib/integrations.ts` — add to the `PROVIDERS` array (see Common Steps below). The `ServiceTestPanel` component automatically picks up any service that has entries in both `PROVIDERS` and `SERVICE_TESTS`. No component changes needed.

---

## Common Steps (All Strategies)

These steps apply regardless of which auth strategy you chose.

### 1. Install dependencies

```bash
pnpm add <sdk-package>
# Strategy C also needs:
pnpm add playwright tls-client
```

### 2. Add to VALID_SERVICES

Edit `src/mcp/agent-config.ts` — add `"{service}"` to the `VALID_SERVICES` array.

### 3. Add to web dashboard

Edit `web/lib/integrations.ts` — add a new provider or add a service to an existing provider:

```typescript
{
  id: "{service}",
  name: "{Service}",
  icon: "IconName",    // Lucide icon name
  color: "#hex",
  description: "What this integration does.",
  available: true,
  services: [
    { id: "{service}", name: "{Service}", icon: "IconName", color: "#hex" },
  ],
},
```

### 4. Create skill file

Create `skills/{service}.SKILL.md` with:
- YAML front matter: `name`, `description`, `metadata` (with emoji)
- First-Time Setup section
- Available Tools section (list every tool)
- Workflow section (numbered steps)
- Examples section (natural language request → tool name)
- Error Handling section

See `skills/gmail.SKILL.md` or `skills/youtube.SKILL.md` for reference.

### 5. Create docs (optional)

Create `docs/{service}.md` with a user-facing setup guide and API reference.

### 6. Update CLAUDE.md

Add the new service to the integrations table in the project root `CLAUDE.md`.

### 7. Build and verify

```bash
pnpm build
pnpm test
pnpm test:integration  # with credentials configured
```

---

## File Summary

| # | File | Action | A | B | C |
|---|---|---|---|---|---|
| 1 | `package.json` | Modify (add deps) | x | x | x |
| 2 | `src/auth/{service}-client.ts` | Create (SDK wrapper) | | x | |
| 3 | `src/auth/{service}-browser-auth.ts` | Create (Playwright login) | | | x |
| 4 | `src/auth/{service}-session-client.ts` | Create (HTTP client) | | | x |
| 5 | `src/auth/session-store.ts` | Create once (shared) | | | x |
| 6 | `src/auth/gmail-auth.ts` | Modify (add OAuth scope) | x | | |
| 7 | `src/tools/gmail-auth-tool.ts` | Modify (add auth factory) | x | | |
| 8 | `src/tools/{service}-auth.ts` | Create (auth setup tool) | | x | x |
| 9 | `src/tools/{service}-{feature}.ts` | Create (1+ files) | x | x | x |
| 10 | `src/mcp/tool-registry.ts` | Modify (imports + register) | x | x | x |
| 11 | `src/types/plugin-config.ts` | Modify (add config key) | | x | |
| 12 | `openclaw.plugin.json` | Modify (schema + uiHints) | | x | |
| 13 | `src/mcp/agent-config.ts` | Modify (VALID_SERVICES) | x | x | x |
| 14 | `web/lib/integrations.ts` | Modify (PROVIDERS) | x | x | x |
| 15 | `web/lib/test-plans.ts` | Modify (SERVICE_TESTS) | x | x | x |
| 16 | `skills/{service}.SKILL.md` | Create | x | x | x |
| 17 | `docs/{service}.md` | Create (optional) | x | x | x |
| 18 | `tests/integration/{service}.test.ts` | Create | x | x | x |
| 19 | `CLAUDE.md` | Modify (integrations table) | x | x | x |
