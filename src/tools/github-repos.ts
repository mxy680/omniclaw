import { Type } from "@sinclair/typebox";
import type { GitHubClient } from "../auth/github-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoListTool(gh: GitHubClient): any {
  return {
    name: "github_repo_list",
    label: "GitHub List Repos",
    description: "List repositories for the authenticated user.",
    parameters: Type.Object({
      type: Type.Optional(
        Type.Union(
          [
            Type.Literal("all"),
            Type.Literal("owner"),
            Type.Literal("public"),
            Type.Literal("private"),
            Type.Literal("member"),
          ],
          { description: "Filter by repo type.", default: "all" },
        ),
      ),
      sort: Type.Optional(
        Type.Union(
          [
            Type.Literal("created"),
            Type.Literal("updated"),
            Type.Literal("pushed"),
            Type.Literal("full_name"),
          ],
          { description: "Sort field.", default: "updated" },
        ),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: { type?: string; sort?: string; per_page?: number; page?: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
          type: (params.type as "all") ?? "all",
          sort: (params.sort as "updated") ?? "updated",
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
        });
        return jsonResult(
          data.map((r) => ({
            full_name: r.full_name,
            description: r.description,
            private: r.private,
            language: r.language,
            stargazers_count: r.stargazers_count,
            updated_at: r.updated_at,
            html_url: r.html_url,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoGetTool(gh: GitHubClient): any {
  return {
    name: "github_repo_get",
    label: "GitHub Get Repo",
    description: "Get detailed information about a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.get({ owner: params.owner, repo: params.repo });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoCreateTool(gh: GitHubClient): any {
  return {
    name: "github_repo_create",
    label: "GitHub Create Repo",
    description: "Create a new repository for the authenticated user.",
    parameters: Type.Object({
      name: Type.String({ description: "Repository name." }),
      description: Type.Optional(Type.String({ description: "Repository description." })),
      private: Type.Optional(
        Type.Boolean({ description: "Whether the repo is private.", default: false }),
      ),
      auto_init: Type.Optional(
        Type.Boolean({ description: "Initialize with a README.", default: false }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { name: string; description?: string; private?: boolean; auto_init?: boolean },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.createForAuthenticatedUser({
          name: params.name,
          description: params.description,
          private: params.private ?? false,
          auto_init: params.auto_init ?? false,
        });
        return jsonResult({
          full_name: data.full_name,
          html_url: data.html_url,
          private: data.private,
          description: data.description,
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoUpdateTool(gh: GitHubClient): any {
  return {
    name: "github_repo_update",
    label: "GitHub Update Repo",
    description: "Update repository settings.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      description: Type.Optional(Type.String({ description: "New description." })),
      private: Type.Optional(Type.Boolean({ description: "Set private/public." })),
      has_issues: Type.Optional(Type.Boolean({ description: "Enable issues." })),
      has_projects: Type.Optional(Type.Boolean({ description: "Enable projects." })),
      has_wiki: Type.Optional(Type.Boolean({ description: "Enable wiki." })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        description?: string;
        private?: boolean;
        has_issues?: boolean;
        has_projects?: boolean;
        has_wiki?: boolean;
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.update({
          owner: params.owner,
          repo: params.repo,
          description: params.description,
          private: params.private,
          has_issues: params.has_issues,
          has_projects: params.has_projects,
          has_wiki: params.has_wiki,
        });
        return jsonResult({
          full_name: data.full_name,
          html_url: data.html_url,
          private: data.private,
          description: data.description,
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoDeleteTool(gh: GitHubClient): any {
  return {
    name: "github_repo_delete",
    label: "GitHub Delete Repo",
    description: "Delete a repository. This action is irreversible.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.repos.delete({ owner: params.owner, repo: params.repo });
        return jsonResult({ success: true, deleted: `${params.owner}/${params.repo}` });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoForkTool(gh: GitHubClient): any {
  return {
    name: "github_repo_fork",
    label: "GitHub Fork Repo",
    description: "Fork a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      organization: Type.Optional(
        Type.String({ description: "Organization to fork into." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; organization?: string },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.createFork({
          owner: params.owner,
          repo: params.repo,
          organization: params.organization,
        });
        return jsonResult({ full_name: data.full_name, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoStarTool(gh: GitHubClient): any {
  return {
    name: "github_repo_star",
    label: "GitHub Star Repo",
    description: "Star a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.activity.starRepoForAuthenticatedUser({
          owner: params.owner,
          repo: params.repo,
        });
        return jsonResult({ success: true, starred: `${params.owner}/${params.repo}` });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoUnstarTool(gh: GitHubClient): any {
  return {
    name: "github_repo_unstar",
    label: "GitHub Unstar Repo",
    description: "Remove a star from a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.activity.unstarRepoForAuthenticatedUser({
          owner: params.owner,
          repo: params.repo,
        });
        return jsonResult({ success: true, unstarred: `${params.owner}/${params.repo}` });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoContentGetTool(gh: GitHubClient): any {
  return {
    name: "github_repo_content_get",
    label: "GitHub Get Content",
    description: "Get the contents of a file or directory in a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      path: Type.String({ description: "Path to file or directory." }),
      ref: Type.Optional(Type.String({ description: "Branch, tag, or commit SHA." })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; path: string; ref?: string },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: params.owner,
          repo: params.repo,
          path: params.path,
          ref: params.ref,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoContentCreateTool(gh: GitHubClient): any {
  return {
    name: "github_repo_content_create",
    label: "GitHub Create/Update File",
    description:
      "Create or update a file in a repository. Provide sha to update an existing file.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      path: Type.String({ description: "Path to the file." }),
      message: Type.String({ description: "Commit message." }),
      content: Type.String({ description: "Base64-encoded file content." }),
      branch: Type.Optional(Type.String({ description: "Branch name." })),
      sha: Type.Optional(
        Type.String({ description: "SHA of the file being replaced (required for updates)." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        path: string;
        message: string;
        content: string;
        branch?: string;
        sha?: string;
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.createOrUpdateFileContents({
          owner: params.owner,
          repo: params.repo,
          path: params.path,
          message: params.message,
          content: params.content,
          branch: params.branch,
          sha: params.sha,
        });
        return jsonResult({
          path: data.content?.path,
          sha: data.content?.sha,
          commit_sha: data.commit.sha,
          html_url: data.content?.html_url,
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoContentDeleteTool(gh: GitHubClient): any {
  return {
    name: "github_repo_content_delete",
    label: "GitHub Delete File",
    description: "Delete a file from a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      path: Type.String({ description: "Path to the file." }),
      message: Type.String({ description: "Commit message." }),
      sha: Type.String({ description: "SHA of the file to delete." }),
      branch: Type.Optional(Type.String({ description: "Branch name." })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string;
        repo: string;
        path: string;
        message: string;
        sha: string;
        branch?: string;
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.deleteFile({
          owner: params.owner,
          repo: params.repo,
          path: params.path,
          message: params.message,
          sha: params.sha,
          branch: params.branch,
        });
        return jsonResult({ success: true, commit_sha: data.commit.sha });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoTopicsTool(gh: GitHubClient): any {
  return {
    name: "github_repo_topics",
    label: "GitHub Repo Topics",
    description: "Get the topics (tags) for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.getAllTopics({
          owner: params.owner,
          repo: params.repo,
        });
        return jsonResult({ topics: data.names });
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoContributorsTool(gh: GitHubClient): any {
  return {
    name: "github_repo_contributors",
    label: "GitHub Repo Contributors",
    description: "List contributors to a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; per_page?: number; page?: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.listContributors({
          owner: params.owner,
          repo: params.repo,
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
        });
        return jsonResult(
          (data ?? []).map((c) => ({
            login: c.login,
            contributions: c.contributions,
            html_url: c.html_url,
            avatar_url: c.avatar_url,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoLanguagesTool(gh: GitHubClient): any {
  return {
    name: "github_repo_languages",
    label: "GitHub Repo Languages",
    description: "Get the language breakdown for a repository (bytes per language).",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.listLanguages({
          owner: params.owner,
          repo: params.repo,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({
          error: "operation_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
