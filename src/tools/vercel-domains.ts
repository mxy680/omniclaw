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
