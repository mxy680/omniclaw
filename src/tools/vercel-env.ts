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
