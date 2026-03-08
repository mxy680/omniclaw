---
name: new-integration
description: Step-by-step guide for adding a new service integration to the Omniclaw MCP server. Web-app-first, auth-first, test-driven workflow.
metadata: {"openclaw": {"emoji": "🔌"}}
---

# New Integration

Add a new service integration to the Omniclaw MCP server. This skill uses a web-app-first, auth-first, test-driven workflow: connect the service to the dashboard, authenticate the user, then build and test each tool one at a time against real credentials.

**IMPORTANT: No unit tests. Only integration tests using real credentials are allowed.** Do not write mocks, stubs, or unit tests. Every test must hit the real API with the user's authenticated credentials.

## Phase 0: Ask Every Question

When this skill is invoked, you MUST complete this questionnaire before writing any code. Use AskUserQuestion to interact with the user. Do NOT proceed until every question is answered.

### Questions to ask

1. **Service name**: What service are you integrating? (e.g., Slack, Notion, Jira, Spotify)
2. **Short ID**: What lowercase identifier should I use? (e.g., `slack`, `notion`, `jira`)
3. **Auth strategy**: Which auth strategy fits this service?
   - **A: Google OAuth** — for Google APIs (Gmail, Calendar, etc.). Reuses existing `OAuthClientManager`.
   - **B: API Key / Token** — for services with official APIs and token/key auth (GitHub, Notion, Stripe, etc.)
   - **C: Session Cookie via Playwright** — for platforms without official APIs or with restrictive access (LinkedIn, Instagram, Slack, Canvas). Automates browser login to capture cookies.
4. **Credentials**: Do you already have credentials ready?
   - Strategy A: "Do you have `client_secret.json` set up? What Google API scope do I need to enable?"
   - Strategy B: "Do you have an API token/key? Where do I get one if not?"
   - Strategy C: "Are you ready to authenticate in a browser window? Do you have login credentials available?"
5. **SDK/library**: Is there an official SDK I should use? (e.g., `@notionhq/client`, `@slack/web-api`) Or should I use raw HTTP?
6. **API docs URL**: Where are the API docs? (URL or "I'll guide you")
7. **Brand color**: What hex color should I use in the dashboard? (e.g., `#0A66C2` for LinkedIn)
8. **Dashboard icon**: What Lucide icon best represents this service? (e.g., `Linkedin`, `MessageSquare`, `Database`) — see https://lucide.dev/icons
9. **TLS fingerprinting**: (Strategy C only) Does this service check TLS fingerprints? If yes, I'll use `tls-client`. If no or unsure, I'll use plain `fetch`.

### Tool brainstorm

After collecting the above, research the service's API and brainstorm an **exhaustive** list of every possible tool, organized by category. For example:

- **Auth**: `{service}_auth_setup`
- **Messages/Items**: `{service}_list`, `{service}_get`, `{service}_search`, `{service}_create`, `{service}_update`, `{service}_delete`
- **Collections/Groups**: `{service}_collection_list`, `{service}_collection_create`, etc.
- **Users/Members**: `{service}_users`, `{service}_user_info`
- **Files/Media**: `{service}_upload`, `{service}_download`
- **Profile/Settings**: `{service}_profile`, `{service}_settings`

Present the full brainstormed list and ask:
- "Which tools do you want? You can add, remove, or reprioritize."
- "Are there any custom tools specific to your use case?"
- "What order should I build them in? (I recommend: auth first, then read-only tools, then write tools)"

Do NOT proceed until the user confirms the final tool list.

---

## Phase 1: Web App Connection

Connect the integration to the web dashboard FIRST, before writing any backend code. This lets the user see it in the UI and authenticate through it.

### Step 1.1: Add to PROVIDERS

Edit `web/lib/integrations.ts` — add to the `PROVIDERS` array:

```typescript
{
  id: "{service}",
  name: "{Service}",
  icon: "{Icon}",          // Lucide icon name from questionnaire
  color: "{#hex}",         // Brand color from questionnaire
  description: "{Description of what this integration does.}",
  available: true,
  services: [
    { id: "{service}", name: "{Service}", icon: "{Icon}", color: "{#hex}" },
  ],
},
```

### Step 1.2: Add to VALID_SERVICES

Edit `src/mcp/agent-config.ts` — add `"{service}"` to the `VALID_SERVICES` array.

### Step 1.3: Add config (Strategy B and C only)

**Strategy B** — add token field:

`src/types/plugin-config.ts`:
```typescript
{service}_token?: string;
```

`openclaw.plugin.json` — add to `configSchema.properties` and `uiHints`:
```json
"{service}_token": {
  "type": "string",
  "description": "{Service} API token."
}
```
```json
"{service}_token": {
  "label": "{Service} API Token"
}
```

**Strategy C** — no config changes needed (session cookies stored at `~/.openclaw/{service}-sessions.json`).

### Step 1.4: Build and verify

```bash
pnpm build
```

Verify the integration appears in the web dashboard. Then tell the user:

> "The integration is now visible in the dashboard. Please authenticate through it now. I'll wait for you to confirm that authentication succeeded before building any tools."

**STOP HERE and wait for the user to confirm authentication.**

---

## Phase 2: Auth Setup Tool

Once the user has credentials working, create the auth client and auth setup tool.

### Strategy A: Google OAuth

**A1. Add OAuth scope** — edit `src/auth/gmail-auth.ts` → `getAuthUrl()` → add the new scope.

**A2. Add auth tool factory** — edit `src/tools/gmail-auth-tool.ts`:

```typescript
export function create{Service}AuthTool(
  clientManager: OAuthClientManager,
  config: PluginConfig,
): any {
  return createAuthTool("{service}", clientManager, config);
}
```

**A3. Register** — edit `src/mcp/tool-registry.ts`, inside the `if (config.client_secret_path)` block:

```typescript
add(create{Service}AuthTool(clientManager, config));
```

### Strategy B: API Key / Token

**B1. Create auth client** — `src/auth/{service}-client.ts` (follow `src/auth/github-client.ts` pattern):

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

  isAuthenticated(): boolean { return this.client !== null; }
  getClient(): SomeSDK { return this.client!; }

  setToken(token: string): void {
    this.token = token;
    this.client = new SomeSDK({ auth: token });
  }
}
```

**B2. Create auth setup tool** — `src/tools/{service}-auth.ts` (follow `src/tools/github-auth.ts`):

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

**B3. Register** — edit `src/mcp/tool-registry.ts`:

```typescript
{
  const {service}Client = new {Service}Client(config.{service}_token);
  add(create{Service}AuthSetupTool({service}Client));
}
```

### Strategy C: Session Cookie via Playwright

**C1. Install dependencies**:

```bash
pnpm add playwright tls-client   # tls-client only if TLS fingerprinting needed
```

**C2. Create SessionStore** (if `src/auth/session-store.ts` doesn't exist yet — shared across all session-cookie integrations):

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

export interface SessionData {
  cookies: Record<string, string>;
  csrfToken?: string;
  userAgent: string;
  capturedAt: number;
  [key: string]: unknown;
}

interface SessionFile { [account: string]: SessionData; }

export class SessionStore {
  constructor(private sessionsPath: string) {}

  private load(): SessionFile {
    if (!existsSync(this.sessionsPath)) return {};
    try { return JSON.parse(readFileSync(this.sessionsPath, "utf-8")) as SessionFile; }
    catch { return {}; }
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

**C3. Create browser auth** — `src/auth/{service}-browser-auth.ts`:

The browser auth module MUST launch a real Playwright browser window and navigate to the service's login page. It does NOT automate the login itself — the user authenticates manually using whatever method they choose (password, SSO, MFA, social login, passkey, etc.). The browser stays open until the user completes login and lands on an authenticated page, at which point cookies are captured automatically.

```typescript
import { chromium } from "playwright";
import type { SessionStore, SessionData } from "./session-store.js";

export async function authenticate{Service}(
  sessionStore: SessionStore,
  account: string = "default",
): Promise<SessionData> {
  // Always launch a VISIBLE browser — never headless.
  // The user must be able to see and interact with the login page
  // to complete auth however they want (password, SSO, MFA, passkey, etc.)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the service's login/home page
  await page.goto("https://{service}.com/login");

  // Wait for the user to finish authenticating — they may use any method.
  // Use a generous timeout (120s+) to allow for MFA, CAPTCHA, SSO redirects, etc.
  // The URL pattern should match any authenticated page, NOT a specific login flow.
  await page.waitForURL(
    (url) => !url.pathname.includes("/login") && !url.pathname.includes("/signin"),
    { timeout: 120_000 },
  );

  // Capture ALL cookies — don't filter, let the session client decide what to use
  const allCookies = await context.cookies();
  const cookies: Record<string, string> = {};
  for (const c of allCookies) cookies[c.name] = c.value;

  // Try to extract CSRF token (from cookie or meta tag — platform-specific)
  const csrfToken = cookies["{csrf_cookie}"] ??
    await page.evaluate(() =>
      document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? ""
    );

  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();

  const session: SessionData = { cookies, csrfToken, userAgent, capturedAt: Date.now() };
  sessionStore.set(account, session);
  return session;
}
```

**C4. Create session client** — `src/auth/{service}-session-client.ts`:

```typescript
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

  isAuthenticated(): boolean { return this.session !== null; }
  reload(account?: string): void {
    this.session = this.sessionStore.get(account ?? this.account) ?? null;
  }

  async request<T = unknown>(opts: {
    method?: string; path: string; body?: unknown; headers?: Record<string, string>;
  }): Promise<T> {
    if (!this.session) throw new Error("not_authenticated");

    const cookieHeader = Object.entries(this.session.cookies)
      .map(([k, v]) => `${k}=${v}`).join("; ");

    const headers: Record<string, string> = {
      "Cookie": cookieHeader,
      "User-Agent": this.session.userAgent,
      ...(this.session.csrfToken ? { "X-CSRFToken": this.session.csrfToken } : {}),
      ...opts.headers,
    };

    // Use tls-client if TLS fingerprinting is needed:
    // import { Session as TlsSession } from "tls-client";
    // const tls = new TlsSession({ clientIdentifier: "chrome_120" });
    // const res = await tls.execute({ method: opts.method ?? "GET", url: `${this.baseUrl}${opts.path}`, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });

    // Otherwise use plain fetch:
    const res = await fetch(`${this.baseUrl}${opts.path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    if (res.status === 401 || res.status === 403) throw new Error("session_expired");
    return res.json() as Promise<T>;
  }
}
```

**C5. Create auth setup tool** — `src/tools/{service}-auth.ts`:

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
    description: "Authenticate with {Service} via browser login.",
    parameters: Type.Object({
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      try {
        await authenticate{Service}(sessionStore, account);
        client.reload(account);
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

**C6. Register** — edit `src/mcp/tool-registry.ts`:

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
}
```

### Verify auth

```bash
pnpm build
```

Test the auth tool manually: `OMNICLAW_MCP_TOKEN=dev pnpm mcp:dev` and call `{service}_auth_setup`. Verify it succeeds with the user's credentials.

Tell the user:

> "Auth is working. I'm now going to build each tool one at a time and test it immediately. I'll show you the test result for each tool before moving on."

---

## Phase 3: Build and Test Each Tool (One at a Time)

For EACH tool in the confirmed tool list, follow this exact loop:

### Step 3.1: Create the tool

Create `src/tools/{service}-{feature}.ts`:

**Strategy A (Google OAuth):**
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
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
      // ... service-specific params
    }),
    async execute(_toolCallId: string, params: { account?: string; /* ... */ }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);
      const client = clientManager.getClient(account);
      const svc = google.{serviceApi}({ version: "v3", auth: client });
      // ... call API
      return jsonResult(result);
    },
  };
}
```

**Strategy B (API Key):**
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

**Strategy C (Session Cookie):**
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
            action: "Call {service}_auth_setup to re-authenticate.",
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

### Step 3.2: Register the tool

Edit `src/mcp/tool-registry.ts` — add the new tool to the existing service block:

```typescript
add(create{Service}{Action}Tool(client));
```

### Step 3.3: Build and test

```bash
pnpm build
```

### Step 3.4: Write the integration test for THIS tool

**No unit tests. No mocks. No stubs.** Every test must call the real API with the user's real credentials. If a test can't run without credentials, use `describe.skipIf(!credentialsExist)` — never fake the response.

Add to `tests/integration/{service}.test.ts`. Create the file if it doesn't exist yet.

**Test file structure** (create once, then add `describe` blocks for each tool):

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

describe.skipIf(!credentialsExist)("{Service} integration", { timeout: 30_000 }, () => {
  let client: /* type depends on auth strategy */;

  beforeAll(() => {
    // Instantiate client
  });

  // Tests get added here one at a time (see below)
});
```

**For each tool, add a describe block:**

Read-only tools:
```typescript
describe("{service}_{action}", () => {
  it("returns expected data", async () => {
    const tool = create{Service}{Action}Tool(client);
    const result = await tool.execute("t", { account: ACCOUNT, /* params */ });
    expect(result.details).toBeDefined();
    // Add specific assertions
  });
});
```

Write tools (gated by `RUN_WRITE_TESTS`):
```typescript
describe.skipIf(!RUN_WRITE_TESTS)("{service}_{action}", () => {
  it("creates, exercises, then cleans up", async () => {
    const createTool = create{Service}CreateTool(client);
    const created = await createTool.execute("t", {
      name: "[omniclaw integration test] smoke",
      account: ACCOUNT,
    });
    const id = created.details?.id;
    expect(id).toBeTruthy();

    // Cleanup
    const deleteTool = create{Service}DeleteTool(client);
    await deleteTool.execute("t", { id, account: ACCOUNT });
  });
});
```

### Step 3.5: Run the test

```bash
pnpm test:integration -- --grep "{service}"
```

Verify it passes with real credentials. If it fails, fix the tool and re-test before moving on.

### Step 3.6: Commit

After each working tool (or logical group of related tools), commit:

```bash
git add -A && git commit -m "feat({service}): add {action} tool with test"
```

### Step 3.7: Repeat

Go back to Step 3.1 for the next tool. Continue until all tools from the confirmed list are built and tested.

---

## Phase 4: Web App Smoke Tests

Add tests to the web dashboard so users can click "Test" to verify the integration.

Edit `web/lib/test-plans.ts`:

```typescript
const {service}Test: ServiceTestFn = async (execute) => {
  const steps: TestStepResult[] = [];

  // Read-only smoke steps
  const s1 = await runStep("List items", "{service}_list", { max_results: 5 }, execute);
  steps.push(s1.result);

  const itemId = (extractResult(s1.data) as { items?: { id?: string }[] })?.items?.[0]?.id;
  if (itemId) {
    steps.push((await runStep("Get item", "{service}_get", { id: itemId }, execute)).result);
  }

  // Write + cleanup steps
  const created = await runStep("Create test item", "{service}_create", {
    name: "[omniclaw smoke test] verify",
  }, execute);
  steps.push(created.result);

  const createdId = (extractResult(created.data) as Record<string, unknown>)?.id as string | undefined;
  if (createdId) {
    steps.push((await runStep("Delete test item", "{service}_delete", { id: createdId }, execute, true)).result);
  }

  return steps;
};

// Add to SERVICE_TESTS:
// {service}: {service}Test,
```

---

## Phase 5: Finalize

### Step 5.1: Create skill file

Create `skills/{service}.SKILL.md` — follow `skills/gmail.SKILL.md` format:

```markdown
---
name: {service}
description: {Service description}
metadata: {"openclaw": {"emoji": "{emoji}"}}
---

# {Service}

{What this integration does.}

## First-Time Setup
1. {How to get credentials}
2. Configure plugin: `openclaw plugins config omniclaw`
3. Call `{service}_auth_setup`

## Available Tools
- `{service}_auth_setup` — Authenticate with {Service}
- `{service}_list` — List items
- ... {all tools}

## Workflow
1. Authenticate with `{service}_auth_setup`
2. Use read tools to explore data
3. Use write tools to create/modify

## Examples
- "List my {items}" → `{service}_list`
- "Get {item} details" → `{service}_get`

## Error Handling
- `auth_required` → Call `{service}_auth_setup`
- `session_expired` (Strategy C) → Re-authenticate
```

### Step 5.2: Update CLAUDE.md

Add the new integration to the integrations table in the root `CLAUDE.md`.

### Step 5.3: Final verification

```bash
pnpm build
pnpm test
pnpm test:integration
```

---

## Platform-Specific Reference (Strategy C)

| Platform | Key Cookies | CSRF | Required Headers | API Base URL | TLS FP | Notes |
|---|---|---|---|---|---|---|
| **LinkedIn** | `li_at`, `JSESSIONID` | `Csrf-Token` = `JSESSIONID` (strip quotes) | `X-Restli-Protocol-Version: 2.0.0` | `https://www.linkedin.com/voyager/api/` | Yes | Voyager API |
| **Instagram** | `sessionid`, `csrftoken`, `ds_user_id`, `mid`, `ig_did` | `X-CSRFToken` = `csrftoken` cookie | `X-IG-App-ID: 936619743392459` | `https://i.instagram.com/api/v1/` | Yes | `csrftoken` rotates every response |
| **Slack** | `d` (starts with `xoxd-`) | N/A | `Authorization: Bearer xoxc-...` (from localStorage) | `https://slack.com/api/` | Yes | Two tokens: `xoxc-` + `d` cookie. All POST. |
| **Canvas** | `canvas_session`, `_csrf_token` | `csrf-token` meta tag | Standard | `{BASE_URL}/api/v1/` | No | SSO + Duo MFA. Link-header pagination. |

### Session-cookie gotchas

- **TLS fingerprinting**: LinkedIn, Instagram, Slack need `tls-client`. Node's native `fetch` will be blocked.
- **CSRF rotation**: Some platforms rotate CSRF tokens every response. Parse `Set-Cookie` and update.
- **Cookie expiry**: Sessions last 24h–30d. No refresh — user must re-authenticate.
- **Headless detection**: Always `headless: false` for login flows.
- **MFA/CAPTCHA**: Cannot be automated. Browser must be visible. Use 120s+ timeouts.

---

## File Summary

| # | File | Action | A | B | C |
|---|---|---|---|---|---|
| 1 | `web/lib/integrations.ts` | Modify (PROVIDERS) | x | x | x |
| 2 | `src/mcp/agent-config.ts` | Modify (VALID_SERVICES) | x | x | x |
| 3 | `package.json` | Modify (add deps) | | x | x |
| 4 | `src/types/plugin-config.ts` | Modify (config key) | | x | |
| 5 | `openclaw.plugin.json` | Modify (schema + uiHints) | | x | |
| 6 | `src/auth/{service}-client.ts` | Create (SDK wrapper) | | x | |
| 7 | `src/auth/{service}-browser-auth.ts` | Create (Playwright login) | | | x |
| 8 | `src/auth/{service}-session-client.ts` | Create (HTTP client) | | | x |
| 9 | `src/auth/session-store.ts` | Create once (shared) | | | x |
| 10 | `src/auth/gmail-auth.ts` | Modify (OAuth scope) | x | | |
| 11 | `src/tools/gmail-auth-tool.ts` | Modify (auth factory) | x | | |
| 12 | `src/tools/{service}-auth.ts` | Create (auth setup tool) | | x | x |
| 13 | `src/tools/{service}-{feature}.ts` | Create (1+ files) | x | x | x |
| 14 | `src/mcp/tool-registry.ts` | Modify (register tools) | x | x | x |
| 15 | `tests/integration/{service}.test.ts` | Create (tests) | x | x | x |
| 16 | `web/lib/test-plans.ts` | Modify (SERVICE_TESTS) | x | x | x |
| 17 | `skills/{service}.SKILL.md` | Create | x | x | x |
| 18 | `CLAUDE.md` | Modify (integrations table) | x | x | x |
