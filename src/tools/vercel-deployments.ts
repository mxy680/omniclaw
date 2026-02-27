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
