---
name: new-integration
description: Step-by-step guide for adding a new service integration to the Omniclaw MCP server. Covers tool files, auth, registry, config, skill, and dashboard.
metadata: {"openclaw": {"emoji": "🔌"}}
---

# New Integration

Add a new service integration to the Omniclaw MCP server. This skill walks through every file that must be created or modified, following the exact patterns used by existing integrations (Gmail, Calendar, Drive, Docs, Sheets, Slides, YouTube, GitHub).

## Prerequisites

Before starting, decide:

1. **Service name** — a short lowercase identifier (e.g. `slack`, `notion`, `jira`). Used as prefix for all tool names.
2. **Auth pattern** — choose one:
   - **Google OAuth** — for any Google API (reuses the existing `OAuthClientManager`).
   - **Token-based** — for non-Google APIs (like GitHub). Requires a dedicated client class.
3. **SDK / API client** — identify the npm package (e.g. `googleapis`, `@slack/web-api`, `@notionhq/client`).

## Checklist

### 1. Install SDK dependency

```bash
pnpm add <sdk-package>
```

### 2. Create auth client (token-based only)

Create `src/auth/{service}-client.ts` following the `GitHubClient` pattern:

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

For **Google OAuth** services, skip this step — use `OAuthClientManager` directly.

### 3. Create auth setup tool

Create `src/tools/{service}-auth.ts`:

**Token-based pattern:**

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
        });
      }
    },
  };
}
```

**Google OAuth pattern:** Add a new `create{Service}AuthTool` export to `src/tools/gmail-auth-tool.ts` alongside the existing auth tool factories. Also add the required OAuth scope to the `scope` array in `src/auth/gmail-auth.ts` → `getAuthUrl()`.

### 4. Create tool files

Create one file per logical feature group: `src/tools/{service}-{feature}.ts`.

Every tool factory follows this shape:

```typescript
import { Type } from "@sinclair/typebox";
import type { {Service}Client } from "../auth/{service}-client.js";
// Or for Google OAuth:
// import { google } from "googleapis";
// import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("{service}");

export function create{Service}{Action}Tool(client: {Service}Client): any {
  return {
    name: "{service}_{action}",
    label: "{Service} {Action}",
    description: "Description of what this tool does.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
      // ... service-specific params
    }),
    async execute(_toolCallId: string, params: { account?: string; /* ... */ }) {
      if (!client.isAuthenticated()) {
        return jsonResult(AUTH_REQUIRED);
      }
      const sdk = client.getClient();
      // ... call the API
      return jsonResult(result);
    },
  };
}
```

Key conventions:
- Tool names: `{service}_{action}` (snake_case)
- Labels: `{Service} {Action}` (title case)
- Every tool returns via `jsonResult()`
- Every tool checks auth and returns `authRequired("{service}")` if not authenticated
- Google OAuth tools use the `account` param with `clientManager.listAccounts().includes(account)` check
- Token-based tools use `client.isAuthenticated()` check

### 5. Register tools in tool-registry.ts

Edit `src/mcp/tool-registry.ts`:

1. Add imports at the top for all new tool factories
2. Add tool instantiation in `createAllTools()`:

**Token-based:**
```typescript
// {Service} tools
{
  const {service}Client = new {Service}Client(config.{service}_token);
  add(create{Service}AuthSetupTool({service}Client));
  add(create{Service}{Action}Tool({service}Client));
  // ...
}
```

**Google OAuth** — add inside the existing `if (config.client_secret_path)` block:
```typescript
add(create{Service}AuthTool(clientManager, config));
add(create{Service}{Action}Tool(clientManager));
```

### 6. Update plugin config

**`src/types/plugin-config.ts`** — add the config field:
```typescript
export interface PluginConfig {
  // ... existing fields
  {service}_token?: string;  // token-based only
}
```

**`openclaw.plugin.json`** — add to `configSchema.properties` and `uiHints`:
```json
{
  "configSchema": {
    "properties": {
      "{service}_token": {
        "type": "string",
        "description": "{Service} API token. Required for {Service} tools."
      }
    }
  },
  "uiHints": {
    "{service}_token": {
      "label": "{Service} API Token"
    }
  }
}
```

For Google OAuth services, skip this step — no new config key needed.

### 7. Add to VALID_SERVICES

Edit `src/mcp/agent-config.ts` and add `"{service}"` to the `VALID_SERVICES` array.

### 8. Add to web dashboard

Edit `web/lib/integrations.ts`:

- Either add a new entry to the `PROVIDERS` array (for a new provider), or add a service to an existing provider's `services` array.

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

### 9. Create skill file

Create `skills/{service}.SKILL.md` following the pattern of existing skills (see `skills/gmail.SKILL.md` for reference). Include:

- YAML front matter with `name`, `description`, `metadata` (emoji)
- First-Time Setup section
- Available Tools section (list every tool)
- Workflow section (numbered steps)
- Examples section (natural language → tool name)
- Error Handling section

### 10. Create docs file (optional)

Create `docs/{service}.md` with a user-facing setup guide and API reference.

### 11. Create integration tests

Create `tests/integration/{service}.test.ts` following the pattern in `tests/integration/gmail.test.ts`.

### 12. Update CLAUDE.md

Add the new service to the integrations table in the project's `CLAUDE.md`.

### 13. Build and verify

```bash
pnpm build
pnpm test
```

## File Summary

| # | File | Action | When |
|---|---|---|---|
| 1 | `package.json` | Modify (add SDK dep) | Always |
| 2 | `src/auth/{service}-client.ts` | Create | Token-based only |
| 3 | `src/auth/gmail-auth.ts` | Modify (add scope) | Google OAuth only |
| 4 | `src/tools/{service}-auth.ts` | Create | Token-based only |
| 5 | `src/tools/gmail-auth-tool.ts` | Modify (add auth factory) | Google OAuth only |
| 6 | `src/tools/{service}-{feature}.ts` | Create (1+ files) | Always |
| 7 | `src/mcp/tool-registry.ts` | Modify (imports + registration) | Always |
| 8 | `src/types/plugin-config.ts` | Modify (add config key) | Token-based only |
| 9 | `openclaw.plugin.json` | Modify (config schema + uiHints) | Token-based only |
| 10 | `src/mcp/agent-config.ts` | Modify (VALID_SERVICES) | Always |
| 11 | `web/lib/integrations.ts` | Modify (PROVIDERS array) | Always |
| 12 | `skills/{service}.SKILL.md` | Create | Always |
| 13 | `docs/{service}.md` | Create (optional) | Always |
| 14 | `tests/integration/{service}.test.ts` | Create | Always |
| 15 | `CLAUDE.md` | Modify (integrations table) | Always |
