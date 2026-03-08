import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubSearchReposTool(manager: GitHubClientManager): any {
  return {
    name: "github_search_repos",
    label: "GitHub Search Repos",
    description: "Search GitHub repositories.",
    parameters: Type.Object({
      q: Type.String({ description: "Search query (GitHub search syntax)." }),
      sort: Type.Optional(
        Type.Union(
          [Type.Literal("stars"), Type.Literal("forks"), Type.Literal("help-wanted-issues"), Type.Literal("updated")],
          { description: "Sort field." },
        ),
      ),
      order: Type.Optional(
        Type.Union([Type.Literal("asc"), Type.Literal("desc")], { description: "Sort order.", default: "desc" }),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { q: string; sort?: string; order?: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.search.repos({
          q: params.q, sort: params.sort as "stars" | undefined,
          order: (params.order as "desc") ?? "desc",
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult({
          total_count: data.total_count,
          items: data.items.map((r) => ({
            full_name: r.full_name, description: r.description, language: r.language,
            stargazers_count: r.stargazers_count, forks_count: r.forks_count, html_url: r.html_url,
          })),
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubSearchCodeTool(manager: GitHubClientManager): any {
  return {
    name: "github_search_code",
    label: "GitHub Search Code",
    description: "Search code across GitHub repositories.",
    parameters: Type.Object({
      q: Type.String({ description: "Search query (GitHub code search syntax)." }),
      sort: Type.Optional(
        Type.Union([Type.Literal("indexed")], { description: "Sort field." }),
      ),
      order: Type.Optional(
        Type.Union([Type.Literal("asc"), Type.Literal("desc")], { description: "Sort order.", default: "desc" }),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { q: string; sort?: string; order?: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.search.code({
          q: params.q, sort: params.sort as "indexed" | undefined,
          order: (params.order as "desc") ?? "desc",
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult({
          total_count: data.total_count,
          items: data.items.map((i) => ({
            name: i.name, path: i.path,
            repository: i.repository.full_name, html_url: i.html_url,
          })),
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubSearchIssuesTool(manager: GitHubClientManager): any {
  return {
    name: "github_search_issues",
    label: "GitHub Search Issues/PRs",
    description: "Search issues and pull requests across GitHub.",
    parameters: Type.Object({
      q: Type.String({ description: "Search query (GitHub issues search syntax)." }),
      sort: Type.Optional(
        Type.Union(
          [Type.Literal("comments"), Type.Literal("reactions"), Type.Literal("interactions"),
           Type.Literal("created"), Type.Literal("updated")],
          { description: "Sort field." },
        ),
      ),
      order: Type.Optional(
        Type.Union([Type.Literal("asc"), Type.Literal("desc")], { description: "Sort order.", default: "desc" }),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { q: string; sort?: string; order?: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.search.issuesAndPullRequests({
          q: params.q, sort: params.sort as "comments" | undefined,
          order: (params.order as "desc") ?? "desc",
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult({
          total_count: data.total_count,
          items: data.items.map((i) => ({
            number: i.number, title: i.title, state: i.state,
            user: i.user?.login, html_url: i.html_url, created_at: i.created_at,
          })),
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubSearchCommitsTool(manager: GitHubClientManager): any {
  return {
    name: "github_search_commits",
    label: "GitHub Search Commits",
    description: "Search commits across GitHub.",
    parameters: Type.Object({
      q: Type.String({ description: "Search query (GitHub commit search syntax)." }),
      sort: Type.Optional(
        Type.Union(
          [Type.Literal("author-date"), Type.Literal("committer-date")],
          { description: "Sort field." },
        ),
      ),
      order: Type.Optional(
        Type.Union([Type.Literal("asc"), Type.Literal("desc")], { description: "Sort order.", default: "desc" }),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { q: string; sort?: string; order?: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.search.commits({
          q: params.q, sort: params.sort as "author-date" | undefined,
          order: (params.order as "desc") ?? "desc",
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult({
          total_count: data.total_count,
          items: data.items.map((c) => ({
            sha: c.sha, message: c.commit.message.substring(0, 200),
            author: c.commit.author?.name, date: c.commit.author?.date,
            html_url: c.html_url,
          })),
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubSearchUsersTool(manager: GitHubClientManager): any {
  return {
    name: "github_search_users",
    label: "GitHub Search Users",
    description: "Search GitHub users.",
    parameters: Type.Object({
      q: Type.String({ description: "Search query (GitHub user search syntax)." }),
      sort: Type.Optional(
        Type.Union(
          [Type.Literal("followers"), Type.Literal("repositories"), Type.Literal("joined")],
          { description: "Sort field." },
        ),
      ),
      order: Type.Optional(
        Type.Union([Type.Literal("asc"), Type.Literal("desc")], { description: "Sort order.", default: "desc" }),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { q: string; sort?: string; order?: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.search.users({
          q: params.q, sort: params.sort as "followers" | undefined,
          order: (params.order as "desc") ?? "desc",
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult({
          total_count: data.total_count,
          items: data.items.map((u) => ({
            login: u.login, type: u.type, html_url: u.html_url, avatar_url: u.avatar_url,
          })),
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
