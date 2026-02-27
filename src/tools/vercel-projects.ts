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
