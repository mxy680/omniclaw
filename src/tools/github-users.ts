import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubUserGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_user_get",
    label: "GitHub Get User",
    description: "Get public information about a GitHub user.",
    parameters: Type.Object({
      username: Type.String({ description: "GitHub username." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { username: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.users.getByUsername({ username: params.username });
        return jsonResult({
          login: data.login, name: data.name, bio: data.bio, company: data.company,
          location: data.location, email: data.email, public_repos: data.public_repos,
          followers: data.followers, following: data.following, html_url: data.html_url,
          created_at: data.created_at, type: data.type,
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubUserReposTool(manager: GitHubClientManager): any {
  return {
    name: "github_user_repos",
    label: "GitHub User Repos",
    description: "List public repositories for a user.",
    parameters: Type.Object({
      username: Type.String({ description: "GitHub username." }),
      sort: Type.Optional(
        Type.Union(
          [Type.Literal("created"), Type.Literal("updated"), Type.Literal("pushed"), Type.Literal("full_name")],
          { description: "Sort field.", default: "updated" },
        ),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { username: string; sort?: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.listForUser({
          username: params.username, sort: (params.sort as "updated") ?? "updated",
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((r) => ({
            full_name: r.full_name, description: r.description, language: r.language,
            stargazers_count: r.stargazers_count, html_url: r.html_url,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubOrgGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_org_get",
    label: "GitHub Get Organization",
    description: "Get information about a GitHub organization.",
    parameters: Type.Object({
      org: Type.String({ description: "Organization login." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { org: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.orgs.get({ org: params.org });
        return jsonResult({
          login: data.login, name: data.name, description: data.description,
          blog: data.blog, location: data.location, email: data.email,
          public_repos: data.public_repos, html_url: data.html_url,
          created_at: data.created_at, type: data.type,
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubOrgMembersTool(manager: GitHubClientManager): any {
  return {
    name: "github_org_members",
    label: "GitHub Org Members",
    description: "List members of an organization.",
    parameters: Type.Object({
      org: Type.String({ description: "Organization login." }),
      role: Type.Optional(
        Type.Union([Type.Literal("all"), Type.Literal("admin"), Type.Literal("member")], {
          description: "Filter by role.", default: "all",
        }),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { org: string; role?: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.orgs.listMembers({
          org: params.org, role: (params.role as "all") ?? "all",
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(data.map((m) => ({ login: m.login, html_url: m.html_url, avatar_url: m.avatar_url })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubOrgReposTool(manager: GitHubClientManager): any {
  return {
    name: "github_org_repos",
    label: "GitHub Org Repos",
    description: "List repositories for an organization.",
    parameters: Type.Object({
      org: Type.String({ description: "Organization login." }),
      type: Type.Optional(
        Type.Union(
          [Type.Literal("all"), Type.Literal("public"), Type.Literal("private"),
           Type.Literal("forks"), Type.Literal("sources"), Type.Literal("member")],
          { description: "Filter by type.", default: "all" },
        ),
      ),
      sort: Type.Optional(
        Type.Union(
          [Type.Literal("created"), Type.Literal("updated"), Type.Literal("pushed"), Type.Literal("full_name")],
          { description: "Sort field.", default: "updated" },
        ),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { org: string; type?: string; sort?: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.listForOrg({
          org: params.org, type: (params.type as "all") ?? "all",
          sort: (params.sort as "updated") ?? "updated",
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((r) => ({
            full_name: r.full_name, description: r.description, language: r.language,
            stargazers_count: r.stargazers_count, private: r.private, html_url: r.html_url,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubTeamListTool(manager: GitHubClientManager): any {
  return {
    name: "github_team_list",
    label: "GitHub List Teams",
    description: "List teams in an organization.",
    parameters: Type.Object({
      org: Type.String({ description: "Organization login." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { org: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.teams.list({
          org: params.org, per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((t) => ({
            id: t.id, name: t.name, slug: t.slug, description: t.description,
            permission: t.permission, html_url: t.html_url,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
