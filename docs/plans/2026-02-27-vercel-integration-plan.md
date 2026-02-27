# Vercel Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 16-tool Vercel integration to omniclaw for managing projects, deployments, domains, and environment variables via the Vercel REST API.

**Architecture:** Bearer token auth via `VercelClientManager` (same pattern as `GitHubClientManager`). Token stored at `~/.openclaw/omniclaw-vercel-tokens.json`. All tools follow the factory-function pattern returning `{ name, label, description, parameters, execute }`. Tools registered in `plugin.ts` before the Google OAuth guard.

**Tech Stack:** TypeScript, `@sinclair/typebox` for parameter schemas, `fetch` for HTTP, `vitest` for tests.

---

## API Reference

All endpoints use base URL `https://api.vercel.com` with header `Authorization: Bearer <token>`.

| Operation | Method | Path |
|-----------|--------|------|
| Get authenticated user | GET | `/v2/user` |
| List projects | GET | `/v9/projects` |
| Get project | GET | `/v9/projects/{idOrName}` |
| Create project | POST | `/v10/projects` |
| Delete project | DELETE | `/v9/projects/{idOrName}` |
| List deployments | GET | `/v6/deployments` |
| Get deployment | GET | `/v13/deployments/{idOrUrl}` |
| Create deployment | POST | `/v13/deployments` |
| Cancel deployment | PATCH | `/v12/deployments/{id}/cancel` |
| Get deployment events | GET | `/v3/deployments/{idOrUrl}/events` |
| List project domains | GET | `/v9/projects/{idOrName}/domains` |
| Add domain to project | POST | `/v10/projects/{idOrName}/domains` |
| Remove domain from project | DELETE | `/v9/projects/{idOrName}/domains/{domain}` |
| List env vars | GET | `/v9/projects/{idOrName}/env` |
| Create env var | POST | `/v10/projects/{idOrName}/env` |
| Delete env var | DELETE | `/v9/projects/{idOrName}/env/{envId}` |

Optional query param for team access: `?teamId=<id>`

---

## Task 1: VercelClientManager

**Files:**
- Create: `src/auth/vercel-client-manager.ts`

**Step 1: Write the client manager**

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";

interface VercelTokenFile {
  [account: string]: { token: string };
}

export class VercelClientManager {
  private static readonly BASE_URL = "https://api.vercel.com";

  constructor(private tokensPath: string) {}

  private load(): VercelTokenFile {
    if (!existsSync(this.tokensPath)) return {};
    try {
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as VercelTokenFile;
    } catch {
      return {};
    }
  }

  private save(data: VercelTokenFile): void {
    const dir = dirname(this.tokensPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.tokensPath, JSON.stringify(data, null, 2), "utf-8");
  }

  setToken(account: string, token: string): void {
    const data = this.load();
    data[account] = { token };
    this.save(data);
  }

  getToken(account: string): string | null {
    return this.load()[account]?.token ?? null;
  }

  hasToken(account: string): boolean {
    return this.getToken(account) !== null;
  }

  listAccounts(): string[] {
    return Object.keys(this.load());
  }

  private buildHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  private resolveToken(account: string): string {
    const token = this.getToken(account);
    if (!token)
      throw new Error(
        "No Vercel token for account: " + account + ". Call vercel_auth_setup first.",
      );
    return token;
  }

  private handleError(res: Response): never {
    if (res.status === 401) {
      throw new Error(
        "Vercel token is invalid or expired. Call vercel_auth_setup with a new token.",
      );
    }
    if (res.status === 403) {
      throw new Error(
        "Vercel API forbidden — possible rate limit or insufficient token permissions.",
      );
    }
    if (res.status === 404) {
      throw new Error("Vercel resource not found (404). Check the project, deployment, or domain.");
    }
    throw new Error(`Vercel API error: ${res.status} ${res.statusText}`);
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${VercelClientManager.BASE_URL}/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  async get(
    account: string,
    path: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    const token = this.resolveToken(account);
    const url = this.buildUrl(path, params);
    const res = await fetch(url, { headers: this.buildHeaders(token) });
    if (!res.ok) this.handleError(res);
    return res.json();
  }

  async post(account: string, path: string, body?: unknown): Promise<unknown> {
    const token = this.resolveToken(account);
    const url = this.buildUrl(path);
    const res = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) this.handleError(res);
    return res.json();
  }

  async patch(account: string, path: string, body?: unknown): Promise<unknown> {
    const token = this.resolveToken(account);
    const url = this.buildUrl(path);
    const res = await fetch(url, {
      method: "PATCH",
      headers: this.buildHeaders(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) this.handleError(res);
    if (res.status === 204) return { status: "ok" };
    return res.json();
  }

  async delete(account: string, path: string): Promise<unknown> {
    const token = this.resolveToken(account);
    const url = this.buildUrl(path);
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.buildHeaders(token),
    });
    if (!res.ok) this.handleError(res);
    if (res.status === 204) return { status: "ok" };
    return res.json();
  }
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors related to `vercel-client-manager.ts`

**Step 3: Commit**

```bash
git add src/auth/vercel-client-manager.ts
git commit -m "feat(vercel): add VercelClientManager for token storage and HTTP methods"
```

---

## Task 2: Auth Setup Tool

**Files:**
- Create: `src/tools/vercel-auth.ts`

**Step 1: Write the auth tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { VercelClientManager } from "../auth/vercel-client-manager.js";
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
export function createVercelAuthTool(manager: VercelClientManager, config: PluginConfig): any {
  return {
    name: "vercel_auth_setup",
    label: "Vercel Auth Setup",
    description:
      "Authenticate with Vercel using a Personal Access Token. " +
      "The token is read from plugin config (vercel_token) by default — just call with no arguments. " +
      "You can also pass a token directly. The tool validates the token by fetching your Vercel profile.",
    parameters: Type.Object({
      token: Type.Optional(
        Type.String({
          description:
            "Vercel API token. If omitted, reads from plugin config vercel_token.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Name for this account (e.g. 'work', 'personal'). Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { token?: string; account?: string }) {
      const account = params.account ?? "default";
      const token = params.token ?? config.vercel_token;

      if (!token) {
        return jsonResult({
          status: "error",
          error:
            "No Vercel token provided. Either pass it as a tool argument or pre-configure via: " +
            'openclaw config set plugins.entries.omniclaw.config.vercel_token "your_token"',
        });
      }

      try {
        const res = await fetch("https://api.vercel.com/v2/user", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          return jsonResult({
            status: "error",
            error:
              "Token is invalid or expired. Generate a new one at https://vercel.com/account/tokens",
          });
        }
        if (!res.ok) {
          return jsonResult({
            status: "error",
            error: `Vercel API returned ${res.status} ${res.statusText}`,
          });
        }

        const data = (await res.json()) as { user?: { username?: string; name?: string; email?: string } };
        const user = data.user ?? {};
        manager.setToken(account, token);

        return jsonResult({
          status: "authenticated",
          account,
          username: user.username ?? "unknown",
          name: user.name ?? "unknown",
          email: user.email ?? "unknown",
        });
      } catch (err) {
        return jsonResult({
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors related to `vercel-auth.ts`

**Step 3: Commit**

```bash
git add src/tools/vercel-auth.ts
git commit -m "feat(vercel): add vercel_auth_setup tool"
```

---

## Task 3: Project Tools

**Files:**
- Create: `src/tools/vercel-projects.ts`

**Step 1: Write the project tools**

```typescript
import { Type } from "@sinclair/typebox";
import type { VercelClientManager } from "../auth/vercel-client-manager.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const VERCEL_AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call vercel_auth_setup with your Vercel API token.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelProjectsTool(manager: VercelClientManager): any {
  return {
    name: "vercel_projects",
    label: "Vercel Projects",
    description: "List all Vercel projects. Returns project name, framework, and latest deployment info.",
    parameters: Type.Object({
      limit: Type.Optional(
        Type.String({
          description: "Max results (1-100). Defaults to '20'.",
          default: "20",
        }),
      ),
      team_id: Type.Optional(
        Type.String({ description: "Team ID to scope the request. Omit for personal account." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { limit?: string; team_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.limit) qp.limit = params.limit;
        if (params.team_id) qp.teamId = params.team_id;
        const data = await manager.get(account, "v9/projects", qp);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelGetProjectTool(manager: VercelClientManager): any {
  return {
    name: "vercel_get_project",
    label: "Vercel Get Project",
    description: "Get details for a specific Vercel project by name or ID.",
    parameters: Type.Object({
      project: Type.String({ description: "Project name or ID." }),
      team_id: Type.Optional(
        Type.String({ description: "Team ID to scope the request." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { project: string; team_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.team_id) qp.teamId = params.team_id;
        const data = await manager.get(account, `v9/projects/${encodeURIComponent(params.project)}`, qp);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelCreateProjectTool(manager: VercelClientManager): any {
  return {
    name: "vercel_create_project",
    label: "Vercel Create Project",
    description: "Create a new Vercel project.",
    parameters: Type.Object({
      name: Type.String({ description: "Project name (lowercase, alphanumeric, hyphens)." }),
      framework: Type.Optional(
        Type.String({
          description:
            "Framework preset (e.g. 'nextjs', 'vite', 'remix', 'nuxtjs', 'svelte'). Auto-detected if connected to git.",
        }),
      ),
      git_repository: Type.Optional(
        Type.Object(
          {
            type: Type.String({ description: "Git provider: 'github', 'gitlab', or 'bitbucket'." }),
            repo: Type.String({ description: "Repository in 'owner/repo' format." }),
          },
          { description: "Connect a git repository to the project." },
        ),
      ),
      build_command: Type.Optional(Type.String({ description: "Custom build command." })),
      output_directory: Type.Optional(Type.String({ description: "Custom output directory." })),
      root_directory: Type.Optional(Type.String({ description: "Root directory for monorepos." })),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        name: string;
        framework?: string;
        git_repository?: { type: string; repo: string };
        build_command?: string;
        output_directory?: string;
        root_directory?: string;
        team_id?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const body: Record<string, unknown> = { name: params.name };
        if (params.framework) body.framework = params.framework;
        if (params.git_repository) body.gitRepository = params.git_repository;
        if (params.build_command) body.buildCommand = params.build_command;
        if (params.output_directory) body.outputDirectory = params.output_directory;
        if (params.root_directory) body.rootDirectory = params.root_directory;

        let path = "v10/projects";
        if (params.team_id) path += `?teamId=${encodeURIComponent(params.team_id)}`;

        const data = await manager.post(account, path, body);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelDeleteProjectTool(manager: VercelClientManager): any {
  return {
    name: "vercel_delete_project",
    label: "Vercel Delete Project",
    description: "Delete a Vercel project by name or ID. This is irreversible.",
    parameters: Type.Object({
      project: Type.String({ description: "Project name or ID to delete." }),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { project: string; team_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        let path = `v9/projects/${encodeURIComponent(params.project)}`;
        if (params.team_id) path += `?teamId=${encodeURIComponent(params.team_id)}`;
        const data = await manager.delete(account, path);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/vercel-projects.ts
git commit -m "feat(vercel): add project tools (list, get, create, delete)"
```

---

## Task 4: Deployment Tools

**Files:**
- Create: `src/tools/vercel-deployments.ts`

**Step 1: Write the deployment tools**

```typescript
import { Type } from "@sinclair/typebox";
import type { VercelClientManager } from "../auth/vercel-client-manager.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const VERCEL_AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call vercel_auth_setup with your Vercel API token.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelDeploymentsTool(manager: VercelClientManager): any {
  return {
    name: "vercel_deployments",
    label: "Vercel Deployments",
    description:
      "List deployments. Filter by project, state, or target environment.",
    parameters: Type.Object({
      project_id: Type.Optional(
        Type.String({ description: "Filter by project ID." }),
      ),
      target: Type.Optional(
        Type.String({ description: "Filter by target: 'production', 'preview'." }),
      ),
      state: Type.Optional(
        Type.String({
          description: "Comma-separated states: 'BUILDING', 'READY', 'ERROR', 'QUEUED', 'CANCELED'.",
        }),
      ),
      limit: Type.Optional(
        Type.String({ description: "Max results (1-100). Defaults to '20'.", default: "20" }),
      ),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        project_id?: string;
        target?: string;
        state?: string;
        limit?: string;
        team_id?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.project_id) qp.projectId = params.project_id;
        if (params.target) qp.target = params.target;
        if (params.state) qp.state = params.state;
        if (params.limit) qp.limit = params.limit;
        if (params.team_id) qp.teamId = params.team_id;
        const data = await manager.get(account, "v6/deployments", qp);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelGetDeploymentTool(manager: VercelClientManager): any {
  return {
    name: "vercel_get_deployment",
    label: "Vercel Get Deployment",
    description: "Get details for a specific deployment by ID or URL.",
    parameters: Type.Object({
      deployment: Type.String({ description: "Deployment ID (dpl_...) or deployment URL." }),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { deployment: string; team_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.team_id) qp.teamId = params.team_id;
        const data = await manager.get(
          account,
          `v13/deployments/${encodeURIComponent(params.deployment)}`,
          qp,
        );
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelCreateDeploymentTool(manager: VercelClientManager): any {
  return {
    name: "vercel_create_deployment",
    label: "Vercel Create Deployment",
    description:
      "Trigger a new deployment. Typically used to redeploy from a git source.",
    parameters: Type.Object({
      name: Type.String({ description: "Project name for the deployment." }),
      target: Type.Optional(
        Type.String({
          description: "Deployment target: 'production' or 'preview'. Defaults to 'preview'.",
        }),
      ),
      git_source: Type.Optional(
        Type.Object(
          {
            type: Type.String({ description: "Git provider: 'github', 'gitlab', or 'bitbucket'." }),
            ref: Type.String({ description: "Git branch or tag to deploy." }),
            sha: Type.String({ description: "Git commit SHA." }),
            repo_id: Type.Optional(Type.String({ description: "Repository ID (numeric)." })),
          },
          { description: "Git source for the deployment." },
        ),
      ),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        name: string;
        target?: string;
        git_source?: { type: string; ref: string; sha: string; repo_id?: string };
        team_id?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const body: Record<string, unknown> = { name: params.name };
        if (params.target) body.target = params.target;
        if (params.git_source) {
          body.gitSource = {
            type: params.git_source.type,
            ref: params.git_source.ref,
            sha: params.git_source.sha,
            ...(params.git_source.repo_id ? { repoId: Number(params.git_source.repo_id) } : {}),
          };
        }

        let path = "v13/deployments";
        if (params.team_id) path += `?teamId=${encodeURIComponent(params.team_id)}`;

        const data = await manager.post(account, path, body);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelCancelDeploymentTool(manager: VercelClientManager): any {
  return {
    name: "vercel_cancel_deployment",
    label: "Vercel Cancel Deployment",
    description: "Cancel a deployment that is currently building.",
    parameters: Type.Object({
      deployment_id: Type.String({ description: "Deployment ID to cancel (dpl_...)." }),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { deployment_id: string; team_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        let path = `v12/deployments/${encodeURIComponent(params.deployment_id)}/cancel`;
        if (params.team_id) path += `?teamId=${encodeURIComponent(params.team_id)}`;
        const data = await manager.patch(account, path);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelDeploymentEventsTool(manager: VercelClientManager): any {
  return {
    name: "vercel_deployment_events",
    label: "Vercel Deployment Events",
    description: "Get build logs and events for a deployment.",
    parameters: Type.Object({
      deployment: Type.String({ description: "Deployment ID or URL." }),
      direction: Type.Optional(
        Type.String({
          description: "Sort direction: 'forward' (oldest first) or 'backward' (newest first). Defaults to 'forward'.",
          default: "forward",
        }),
      ),
      limit: Type.Optional(
        Type.String({ description: "Max events to return. Defaults to '100'.", default: "100" }),
      ),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        deployment: string;
        direction?: string;
        limit?: string;
        team_id?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.direction) qp.direction = params.direction;
        if (params.limit) qp.limit = params.limit;
        if (params.team_id) qp.teamId = params.team_id;
        const data = await manager.get(
          account,
          `v3/deployments/${encodeURIComponent(params.deployment)}/events`,
          qp,
        );
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/vercel-deployments.ts
git commit -m "feat(vercel): add deployment tools (list, get, create, cancel, events)"
```

---

## Task 5: Domain Tools

**Files:**
- Create: `src/tools/vercel-domains.ts`

**Step 1: Write the domain tools**

```typescript
import { Type } from "@sinclair/typebox";
import type { VercelClientManager } from "../auth/vercel-client-manager.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const VERCEL_AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call vercel_auth_setup with your Vercel API token.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelDomainsTool(manager: VercelClientManager): any {
  return {
    name: "vercel_domains",
    label: "Vercel Domains",
    description: "List domains for a Vercel project.",
    parameters: Type.Object({
      project: Type.String({ description: "Project name or ID." }),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { project: string; team_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.team_id) qp.teamId = params.team_id;
        const data = await manager.get(
          account,
          `v9/projects/${encodeURIComponent(params.project)}/domains`,
          qp,
        );
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelAddDomainTool(manager: VercelClientManager): any {
  return {
    name: "vercel_add_domain",
    label: "Vercel Add Domain",
    description: "Add a domain to a Vercel project.",
    parameters: Type.Object({
      project: Type.String({ description: "Project name or ID." }),
      domain: Type.String({ description: "Domain name to add (e.g. 'example.com')." }),
      redirect: Type.Optional(
        Type.String({ description: "Domain to redirect to (for redirect domains)." }),
      ),
      redirect_status_code: Type.Optional(
        Type.String({ description: "HTTP redirect status code: '301', '302', '307', '308'." }),
      ),
      git_branch: Type.Optional(
        Type.String({ description: "Git branch to associate with this domain." }),
      ),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        project: string;
        domain: string;
        redirect?: string;
        redirect_status_code?: string;
        git_branch?: string;
        team_id?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const body: Record<string, unknown> = { name: params.domain };
        if (params.redirect) body.redirect = params.redirect;
        if (params.redirect_status_code)
          body.redirectStatusCode = Number(params.redirect_status_code);
        if (params.git_branch) body.gitBranch = params.git_branch;

        let path = `v10/projects/${encodeURIComponent(params.project)}/domains`;
        if (params.team_id) path += `?teamId=${encodeURIComponent(params.team_id)}`;

        const data = await manager.post(account, path, body);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelRemoveDomainTool(manager: VercelClientManager): any {
  return {
    name: "vercel_remove_domain",
    label: "Vercel Remove Domain",
    description: "Remove a domain from a Vercel project.",
    parameters: Type.Object({
      project: Type.String({ description: "Project name or ID." }),
      domain: Type.String({ description: "Domain name to remove." }),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { project: string; domain: string; team_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        let path = `v9/projects/${encodeURIComponent(params.project)}/domains/${encodeURIComponent(params.domain)}`;
        if (params.team_id) path += `?teamId=${encodeURIComponent(params.team_id)}`;
        const data = await manager.delete(account, path);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/vercel-domains.ts
git commit -m "feat(vercel): add domain tools (list, add, remove)"
```

---

## Task 6: Environment Variable Tools

**Files:**
- Create: `src/tools/vercel-env.ts`

**Step 1: Write the env var tools**

```typescript
import { Type } from "@sinclair/typebox";
import type { VercelClientManager } from "../auth/vercel-client-manager.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const VERCEL_AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call vercel_auth_setup with your Vercel API token.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelEnvVarsTool(manager: VercelClientManager): any {
  return {
    name: "vercel_env_vars",
    label: "Vercel Env Vars",
    description: "List environment variables for a Vercel project.",
    parameters: Type.Object({
      project: Type.String({ description: "Project name or ID." }),
      decrypt: Type.Optional(
        Type.String({
          description: "Set to 'true' to return decrypted secret values. Defaults to 'false'.",
          default: "false",
        }),
      ),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { project: string; decrypt?: string; team_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const qp: Record<string, string> = {};
        if (params.decrypt === "true") qp.decrypt = "true";
        if (params.team_id) qp.teamId = params.team_id;
        const data = await manager.get(
          account,
          `v9/projects/${encodeURIComponent(params.project)}/env`,
          qp,
        );
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelCreateEnvVarTool(manager: VercelClientManager): any {
  return {
    name: "vercel_create_env_var",
    label: "Vercel Create Env Var",
    description: "Create or update an environment variable for a Vercel project.",
    parameters: Type.Object({
      project: Type.String({ description: "Project name or ID." }),
      key: Type.String({ description: "Environment variable name." }),
      value: Type.String({ description: "Environment variable value." }),
      type: Type.Optional(
        Type.String({
          description: "Variable type: 'plain', 'secret', 'encrypted', 'sensitive'. Defaults to 'encrypted'.",
          default: "encrypted",
        }),
      ),
      target: Type.Optional(
        Type.Array(
          Type.String({
            description: "Target environments: 'production', 'preview', 'development'.",
          }),
          {
            description:
              "Target environments. Defaults to all: ['production', 'preview', 'development'].",
          },
        ),
      ),
      git_branch: Type.Optional(
        Type.String({ description: "Git branch to scope the variable to (preview only)." }),
      ),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        project: string;
        key: string;
        value: string;
        type?: string;
        target?: string[];
        git_branch?: string;
        team_id?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        const body: Record<string, unknown> = {
          key: params.key,
          value: params.value,
          type: params.type ?? "encrypted",
          target: params.target ?? ["production", "preview", "development"],
        };
        if (params.git_branch) body.gitBranch = params.git_branch;

        let path = `v10/projects/${encodeURIComponent(params.project)}/env`;
        const qpParts: string[] = [];
        if (params.team_id) qpParts.push(`teamId=${encodeURIComponent(params.team_id)}`);
        qpParts.push("upsert=true");
        path += `?${qpParts.join("&")}`;

        const data = await manager.post(account, path, body);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createVercelDeleteEnvVarTool(manager: VercelClientManager): any {
  return {
    name: "vercel_delete_env_var",
    label: "Vercel Delete Env Var",
    description: "Delete an environment variable from a Vercel project.",
    parameters: Type.Object({
      project: Type.String({ description: "Project name or ID." }),
      env_id: Type.String({ description: "Environment variable ID (from vercel_env_vars)." }),
      team_id: Type.Optional(Type.String({ description: "Team ID to scope the request." })),
      account: Type.Optional(
        Type.String({ description: "Account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { project: string; env_id: string; team_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasToken(account)) return jsonResult(VERCEL_AUTH_REQUIRED);
      try {
        let path = `v9/projects/${encodeURIComponent(params.project)}/env/${encodeURIComponent(params.env_id)}`;
        if (params.team_id) path += `?teamId=${encodeURIComponent(params.team_id)}`;
        const data = await manager.delete(account, path);
        return jsonResult(data);
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tools/vercel-env.ts
git commit -m "feat(vercel): add environment variable tools (list, create, delete)"
```

---

## Task 7: Plugin Registration + Config

**Files:**
- Modify: `src/types/plugin-config.ts` — add `vercel_token` field
- Modify: `openclaw.plugin.json` — add `vercel_token` to configSchema
- Modify: `src/plugin.ts` — register Vercel tools

**Step 1: Add `vercel_token` to PluginConfig**

In `src/types/plugin-config.ts`, add after the last field in the interface:

```typescript
  vercel_token?: string;
```

**Step 2: Add `vercel_token` to openclaw.plugin.json**

In `openclaw.plugin.json`, add to `configSchema.properties`:

```json
    "vercel_token": {
      "type": "string",
      "description": "Vercel Personal Access Token. Get one at https://vercel.com/account/tokens"
    }
```

**Step 3: Register tools in plugin.ts**

Add the following imports at the top of `src/plugin.ts` (alongside other tool imports):

```typescript
import { VercelClientManager } from "./auth/vercel-client-manager.js";
import { createVercelAuthTool } from "./tools/vercel-auth.js";
import {
  createVercelProjectsTool,
  createVercelGetProjectTool,
  createVercelCreateProjectTool,
  createVercelDeleteProjectTool,
} from "./tools/vercel-projects.js";
import {
  createVercelDeploymentsTool,
  createVercelGetDeploymentTool,
  createVercelCreateDeploymentTool,
  createVercelCancelDeploymentTool,
  createVercelDeploymentEventsTool,
} from "./tools/vercel-deployments.js";
import {
  createVercelDomainsTool,
  createVercelAddDomainTool,
  createVercelRemoveDomainTool,
} from "./tools/vercel-domains.js";
import {
  createVercelEnvVarsTool,
  createVercelCreateEnvVarTool,
  createVercelDeleteEnvVarTool,
} from "./tools/vercel-env.js";
```

Add the following registration block in `plugin.ts` near the GitHub registration section (before the `client_secret_path` guard):

```typescript
  // Vercel tools — register unconditionally, no Google credentials required
  const vercelTokensPath = config.tokens_path
    ? path.join(path.dirname(config.tokens_path), "omniclaw-vercel-tokens.json")
    : path.join(defaultTokensDir, "omniclaw-vercel-tokens.json");

  const vercelManager = new VercelClientManager(vercelTokensPath);

  reg(createVercelAuthTool(vercelManager, config));
  reg(createVercelProjectsTool(vercelManager));
  reg(createVercelGetProjectTool(vercelManager));
  reg(createVercelCreateProjectTool(vercelManager));
  reg(createVercelDeleteProjectTool(vercelManager));
  reg(createVercelDeploymentsTool(vercelManager));
  reg(createVercelGetDeploymentTool(vercelManager));
  reg(createVercelCreateDeploymentTool(vercelManager));
  reg(createVercelCancelDeploymentTool(vercelManager));
  reg(createVercelDeploymentEventsTool(vercelManager));
  reg(createVercelDomainsTool(vercelManager));
  reg(createVercelAddDomainTool(vercelManager));
  reg(createVercelRemoveDomainTool(vercelManager));
  reg(createVercelEnvVarsTool(vercelManager));
  reg(createVercelCreateEnvVarTool(vercelManager));
  reg(createVercelDeleteEnvVarTool(vercelManager));
```

**Step 4: Verify it compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Build**

Run: `pnpm build`
Expected: Clean build with no errors

**Step 6: Commit**

```bash
git add src/types/plugin-config.ts openclaw.plugin.json src/plugin.ts
git commit -m "feat(vercel): register 16 Vercel tools in plugin"
```

---

## Task 8: Skill File

**Files:**
- Create: `skills/vercel.SKILL.md`

**Step 1: Write the skill file**

```markdown
---
name: vercel
description: Vercel integration — manage projects, deployments, domains, and environment variables.
metadata: {"openclaw": {"emoji": "▲"}}
---

# Vercel

Manage Vercel projects, deployments, domains, and environment variables using natural language.

## First-Time Setup

Vercel uses a Personal Access Token — no OAuth flow needed.

1. Create a token at https://vercel.com/account/tokens
   - Select the appropriate scope (full account or specific team).
2. Save your token in the plugin config:

\`\`\`bash
openclaw config set plugins.entries.omniclaw.config.vercel_token "your_token_here"
\`\`\`

3. Call `vercel_auth_setup` with no arguments to validate:

\`\`\`
vercel_auth_setup
\`\`\`

The tool reads the token from config, verifies it against the Vercel API, and stores it for subsequent tool calls.

## Available Tools

### Auth
- `vercel_auth_setup` — Validate and store a Vercel API token (run once)

### Projects
- `vercel_projects` — List all projects
- `vercel_get_project` — Get project details by name or ID
- `vercel_create_project` — Create a new project (optionally linked to a git repo)
- `vercel_delete_project` — Delete a project (irreversible)

### Deployments
- `vercel_deployments` — List deployments (filter by project, state, target)
- `vercel_get_deployment` — Get deployment details
- `vercel_create_deployment` — Trigger a new deployment
- `vercel_cancel_deployment` — Cancel a building deployment
- `vercel_deployment_events` — Get build logs and events

### Domains
- `vercel_domains` — List domains for a project
- `vercel_add_domain` — Add a domain to a project
- `vercel_remove_domain` — Remove a domain from a project

### Environment Variables
- `vercel_env_vars` — List env vars for a project
- `vercel_create_env_var` — Create or update an env var (supports upsert)
- `vercel_delete_env_var` — Delete an env var

## Team Access

All tools accept an optional `team_id` parameter. Omit it for personal account access, or provide your Team ID for team-scoped operations.

## Workflow

1. Call `vercel_auth_setup` with no arguments — the tool reads the token from config automatically.
2. Use `vercel_projects` to see your projects.
3. Use `vercel_deployments` with a `project_id` to check deployment status.
4. Use `vercel_deployment_events` to view build logs for a specific deployment.
5. Use `vercel_env_vars` to check environment variables for a project.
6. Use `vercel_domains` to see which domains are connected.

## Error Handling

If any tool returns `"error": "auth_required"`, call `vercel_auth_setup` first.

If a token is invalid or expired, generate a new one at https://vercel.com/account/tokens and call `vercel_auth_setup` again.
```

**Step 2: Commit**

```bash
git add skills/vercel.SKILL.md
git commit -m "feat(vercel): add vercel skill file"
```

---

## Task 9: Documentation

**Files:**
- Create: `docs/vercel.md`

**Step 1: Write the docs**

```markdown
# Vercel Integration

16 tools for managing projects, deployments, domains, and environment variables through your AI agent.

## Setup

Vercel tools use a Personal Access Token — no OAuth flow required.

### Step 1: Create a Personal Access Token

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Click **Create**
3. Give it a name (e.g. "omniclaw")
4. Select the scope (Full Account or specific team)
5. Copy the token

### Step 2: Configure

**Option A:** Set via config:
\`\`\`bash
openclaw config set plugins.entries.omniclaw.config.vercel_token "your_token_here"
\`\`\`

**Option B:** Let the agent prompt you. Ask your agent:
> "Set up Vercel"

It will call `vercel_auth_setup` and walk you through it.

## Tools

| Tool | Description |
|------|-------------|
| `vercel_auth_setup` | Validate and store your Vercel API token |
| `vercel_projects` | List all projects |
| `vercel_get_project` | Get details for a specific project |
| `vercel_create_project` | Create a new project |
| `vercel_delete_project` | Delete a project |
| `vercel_deployments` | List deployments (filter by project, state, target) |
| `vercel_get_deployment` | Get deployment details |
| `vercel_create_deployment` | Trigger a new deployment |
| `vercel_cancel_deployment` | Cancel a building deployment |
| `vercel_deployment_events` | Get build logs and events for a deployment |
| `vercel_domains` | List domains for a project |
| `vercel_add_domain` | Add a domain to a project |
| `vercel_remove_domain` | Remove a domain from a project |
| `vercel_env_vars` | List environment variables for a project |
| `vercel_create_env_var` | Create or update an environment variable |
| `vercel_delete_env_var` | Delete an environment variable |

## Configuration

All configuration is set via `openclaw config set plugins.entries.omniclaw.config.<key> <value>`.

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `vercel_token` | No | — | Vercel API token. Can also be set interactively via `vercel_auth_setup` |

## Usage Examples

> "Show me all my Vercel projects"
> "What's the deployment status for my-app?"
> "Show me the build logs for the latest deployment"
> "Add the domain example.com to project my-app"
> "Set the env var DATABASE_URL to postgres://... on project my-app for production"
> "Create a new Vercel project called my-new-app linked to github:mxy680/my-new-app"
```

**Step 2: Commit**

```bash
git add docs/vercel.md
git commit -m "feat(vercel): add integration documentation"
```

---

## Task 10: Integration Tests

**Files:**
- Create: `tests/integration/vercel.test.ts`

**Step 1: Write the integration tests**

```typescript
/**
 * Integration tests — hit the real Vercel API.
 *
 * Required: Vercel token stored at ~/.openclaw/omniclaw-vercel-tokens.json
 * Or env var: VERCEL_TOKEN
 *
 * Run:
 *   pnpm vitest run tests/integration/vercel.test.ts
 *
 * Write tests (create/delete project) are opt-in:
 *   RUN_WRITE_TESTS=1 VERCEL_TOKEN=<token> pnpm vitest run tests/integration/vercel.test.ts
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";
import { VercelClientManager } from "../../src/auth/vercel-client-manager.js";
import { createVercelAuthTool } from "../../src/tools/vercel-auth.js";
import {
  createVercelProjectsTool,
  createVercelGetProjectTool,
  createVercelCreateProjectTool,
  createVercelDeleteProjectTool,
} from "../../src/tools/vercel-projects.js";
import {
  createVercelDeploymentsTool,
  createVercelGetDeploymentTool,
  createVercelDeploymentEventsTool,
} from "../../src/tools/vercel-deployments.js";
import {
  createVercelDomainsTool,
} from "../../src/tools/vercel-domains.js";
import {
  createVercelEnvVarsTool,
} from "../../src/tools/vercel-env.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TOKENS_PATH = join(homedir(), ".openclaw", "omniclaw-vercel-tokens.json");
const ACCOUNT = "default";

const envToken = process.env.VERCEL_TOKEN;
const hasCredentials = !!envToken || existsSync(TOKENS_PATH);
const runWriteTests = process.env.RUN_WRITE_TESTS === "1";

if (!hasCredentials) {
  console.warn(
    "\n[integration] Skipping Vercel: no token found.\n" +
      `  Set VERCEL_TOKEN env var or add token to ${TOKENS_PATH}\n`,
  );
}

let vercelManager: VercelClientManager;

// ---------------------------------------------------------------------------
describe.skipIf(!hasCredentials)("Vercel API integration", { timeout: 30_000 }, () => {
  beforeAll(() => {
    vercelManager = new VercelClientManager(TOKENS_PATH);
    if (envToken && !vercelManager.hasToken(ACCOUNT)) {
      vercelManager.setToken(ACCOUNT, envToken);
    }
  });

  // -------------------------------------------------------------------------
  // vercel_auth_setup
  // -------------------------------------------------------------------------
  describe("vercel_auth_setup", () => {
    it("validates an existing token", async () => {
      const tool = createVercelAuthTool(vercelManager, { client_secret_path: "" });
      const token = vercelManager.getToken(ACCOUNT);
      const result = await tool.execute("t", { token, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.status).toBe("authenticated");
      expect(typeof result.details.username).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // vercel_projects
  // -------------------------------------------------------------------------
  describe("vercel_projects", () => {
    it("lists projects", async () => {
      const tool = createVercelProjectsTool(vercelManager);
      const result = await tool.execute("t", { account: ACCOUNT, limit: "5" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("projects");
      expect(Array.isArray(result.details.projects)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // vercel_get_project (uses first project from list)
  // -------------------------------------------------------------------------
  describe("vercel_get_project", () => {
    it("gets project details", async () => {
      // First, list projects to get a real project name
      const listTool = createVercelProjectsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const projects = listResult.details?.projects;
      if (!projects || projects.length === 0) {
        console.warn("No projects found — skipping vercel_get_project test");
        return;
      }

      const projectName = projects[0].name;
      const tool = createVercelGetProjectTool(vercelManager);
      const result = await tool.execute("t", { project: projectName, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details.name).toBe(projectName);
    });
  });

  // -------------------------------------------------------------------------
  // vercel_deployments
  // -------------------------------------------------------------------------
  describe("vercel_deployments", () => {
    it("lists deployments", async () => {
      const tool = createVercelDeploymentsTool(vercelManager);
      const result = await tool.execute("t", { account: ACCOUNT, limit: "5" });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("deployments");
      expect(Array.isArray(result.details.deployments)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // vercel_get_deployment (uses first deployment from list)
  // -------------------------------------------------------------------------
  describe("vercel_get_deployment", () => {
    it("gets deployment details", async () => {
      const listTool = createVercelDeploymentsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const deployments = listResult.details?.deployments;
      if (!deployments || deployments.length === 0) {
        console.warn("No deployments found — skipping vercel_get_deployment test");
        return;
      }

      const deploymentId = deployments[0].uid;
      const tool = createVercelGetDeploymentTool(vercelManager);
      const result = await tool.execute("t", { deployment: deploymentId, account: ACCOUNT });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("id");
    });
  });

  // -------------------------------------------------------------------------
  // vercel_deployment_events
  // -------------------------------------------------------------------------
  describe("vercel_deployment_events", () => {
    it("gets build events for a deployment", async () => {
      const listTool = createVercelDeploymentsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const deployments = listResult.details?.deployments;
      if (!deployments || deployments.length === 0) {
        console.warn("No deployments found — skipping vercel_deployment_events test");
        return;
      }

      const deploymentId = deployments[0].uid;
      const tool = createVercelDeploymentEventsTool(vercelManager);
      const result = await tool.execute("t", {
        deployment: deploymentId,
        limit: "10",
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      // Events come back as an array
      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // vercel_domains (requires a project)
  // -------------------------------------------------------------------------
  describe("vercel_domains", () => {
    it("lists domains for a project", async () => {
      const listTool = createVercelProjectsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const projects = listResult.details?.projects;
      if (!projects || projects.length === 0) {
        console.warn("No projects found — skipping vercel_domains test");
        return;
      }

      const tool = createVercelDomainsTool(vercelManager);
      const result = await tool.execute("t", {
        project: projects[0].name,
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("domains");
    });
  });

  // -------------------------------------------------------------------------
  // vercel_env_vars (requires a project)
  // -------------------------------------------------------------------------
  describe("vercel_env_vars", () => {
    it("lists env vars for a project", async () => {
      const listTool = createVercelProjectsTool(vercelManager);
      const listResult = await listTool.execute("t", { account: ACCOUNT, limit: "1" });
      const projects = listResult.details?.projects;
      if (!projects || projects.length === 0) {
        console.warn("No projects found — skipping vercel_env_vars test");
        return;
      }

      const tool = createVercelEnvVarsTool(vercelManager);
      const result = await tool.execute("t", {
        project: projects[0].name,
        account: ACCOUNT,
      });

      expect(result.details).not.toHaveProperty("error");
      expect(result.details).toHaveProperty("envs");
    });
  });

  // -------------------------------------------------------------------------
  // Write tests (opt-in)
  // -------------------------------------------------------------------------
  describe.skipIf(!runWriteTests)("write operations", () => {
    const testProjectName = `omniclaw-test-${Date.now()}`;

    it("creates and deletes a project", async () => {
      const createTool = createVercelCreateProjectTool(vercelManager);
      const createResult = await createTool.execute("t", {
        name: testProjectName,
        framework: "nextjs",
        account: ACCOUNT,
      });

      expect(createResult.details).not.toHaveProperty("error");
      expect(createResult.details.name).toBe(testProjectName);

      // Clean up: delete the project
      const deleteTool = createVercelDeleteProjectTool(vercelManager);
      const deleteResult = await deleteTool.execute("t", {
        project: testProjectName,
        account: ACCOUNT,
      });

      expect(deleteResult.details).not.toHaveProperty("error");
    });
  });
});
```

**Step 2: Run the tests (requires VERCEL_TOKEN)**

Run: `VERCEL_TOKEN="<your_token>" pnpm vitest run tests/integration/vercel.test.ts`
Expected: All read-only tests pass. Write tests skipped unless `RUN_WRITE_TESTS=1`.

**Step 3: Commit**

```bash
git add tests/integration/vercel.test.ts
git commit -m "test(vercel): add integration tests"
```

---

## Task 11: Update CLAUDE.md Kanban

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Move Vercel to Done in the kanban**

In `CLAUDE.md`, add a new row to the "Done" table:

```markdown
| Vercel | 16 | `vercel` | `docs/vercel.md` | Personal Access Token |
```

And remove the Vercel row from the "Planned" table (the `| Vercel | #38 | |` row).

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: move Vercel to Done in kanban"
```

---

## Summary

| Task | Description | Files | Tools |
|------|-------------|-------|-------|
| 1 | VercelClientManager | `src/auth/vercel-client-manager.ts` | — |
| 2 | Auth tool | `src/tools/vercel-auth.ts` | 1 |
| 3 | Project tools | `src/tools/vercel-projects.ts` | 4 |
| 4 | Deployment tools | `src/tools/vercel-deployments.ts` | 5 |
| 5 | Domain tools | `src/tools/vercel-domains.ts` | 3 |
| 6 | Env var tools | `src/tools/vercel-env.ts` | 3 |
| 7 | Plugin registration + config | `plugin.ts`, `plugin-config.ts`, `openclaw.plugin.json` | — |
| 8 | Skill file | `skills/vercel.SKILL.md` | — |
| 9 | Documentation | `docs/vercel.md` | — |
| 10 | Integration tests | `tests/integration/vercel.test.ts` | — |
| 11 | Update kanban | `CLAUDE.md` | — |

**Total: 16 tools, 11 tasks, 12 files**
