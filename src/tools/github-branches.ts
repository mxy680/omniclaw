import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubBranchListTool(manager: GitHubClientManager): any {
  return {
    name: "github_branch_list",
    label: "GitHub List Branches",
    description: "List branches for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      protected: Type.Optional(Type.Boolean({ description: "Filter to protected branches only." })),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; protected?: boolean; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.listBranches({
          owner: params.owner, repo: params.repo,
          protected: params.protected, per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(data.map((b) => ({ name: b.name, protected: b.protected, commit_sha: b.commit.sha })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubBranchGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_branch_get",
    label: "GitHub Get Branch",
    description: "Get details about a specific branch.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      branch: Type.String({ description: "Branch name." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; branch: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.getBranch({
          owner: params.owner, repo: params.repo, branch: params.branch,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubBranchCreateTool(manager: GitHubClientManager): any {
  return {
    name: "github_branch_create",
    label: "GitHub Create Branch",
    description: "Create a new branch from a commit SHA.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      branch: Type.String({ description: "New branch name." }),
      sha: Type.String({ description: "Commit SHA to branch from." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; branch: string; sha: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.git.createRef({
          owner: params.owner, repo: params.repo,
          ref: `refs/heads/${params.branch}`, sha: params.sha,
        });
        return jsonResult({ ref: data.ref, sha: data.object.sha });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubBranchDeleteTool(manager: GitHubClientManager): any {
  return {
    name: "github_branch_delete",
    label: "GitHub Delete Branch",
    description: "Delete a branch.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      branch: Type.String({ description: "Branch name to delete." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; branch: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.git.deleteRef({
          owner: params.owner, repo: params.repo, ref: `heads/${params.branch}`,
        });
        return jsonResult({ success: true, deleted: params.branch });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubBranchProtectionGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_branch_protection_get",
    label: "GitHub Get Branch Protection",
    description: "Get branch protection rules for a branch.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      branch: Type.String({ description: "Branch name." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; branch: string; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.getBranchProtection({
          owner: params.owner, repo: params.repo, branch: params.branch,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubTagListTool(manager: GitHubClientManager): any {
  return {
    name: "github_tag_list",
    label: "GitHub List Tags",
    description: "List tags for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.listTags({
          owner: params.owner, repo: params.repo,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((t) => ({
            name: t.name, commit_sha: t.commit.sha,
            tarball_url: t.tarball_url, zipball_url: t.zipball_url,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubReleaseListTool(manager: GitHubClientManager): any {
  return {
    name: "github_release_list",
    label: "GitHub List Releases",
    description: "List releases for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; per_page?: number; page?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.listReleases({
          owner: params.owner, repo: params.repo,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((r) => ({
            id: r.id, tag_name: r.tag_name, name: r.name,
            draft: r.draft, prerelease: r.prerelease,
            created_at: r.created_at, published_at: r.published_at,
            html_url: r.html_url, body: r.body?.substring(0, 500),
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubReleaseGetTool(manager: GitHubClientManager): any {
  return {
    name: "github_release_get",
    label: "GitHub Get Release",
    description: "Get details about a specific release.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      release_id: Type.Number({ description: "Release ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; release_id: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.getRelease({
          owner: params.owner, repo: params.repo, release_id: params.release_id,
        });
        return jsonResult(data);
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubReleaseCreateTool(manager: GitHubClientManager): any {
  return {
    name: "github_release_create",
    label: "GitHub Create Release",
    description: "Create a new release.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      tag_name: Type.String({ description: "Tag name for the release." }),
      name: Type.Optional(Type.String({ description: "Release name." })),
      body: Type.Optional(Type.String({ description: "Release notes (markdown)." })),
      draft: Type.Optional(Type.Boolean({ description: "Create as draft.", default: false })),
      prerelease: Type.Optional(Type.Boolean({ description: "Mark as prerelease.", default: false })),
      target_commitish: Type.Optional(Type.String({ description: "Branch or commit SHA for the tag." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string; repo: string; tag_name: string; name?: string; body?: string;
        draft?: boolean; prerelease?: boolean; target_commitish?: string; account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.createRelease({
          owner: params.owner, repo: params.repo, tag_name: params.tag_name,
          name: params.name, body: params.body, draft: params.draft ?? false,
          prerelease: params.prerelease ?? false, target_commitish: params.target_commitish,
        });
        return jsonResult({ id: data.id, tag_name: data.tag_name, name: data.name, html_url: data.html_url });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubReleaseDeleteTool(manager: GitHubClientManager): any {
  return {
    name: "github_release_delete",
    label: "GitHub Delete Release",
    description: "Delete a release.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      release_id: Type.Number({ description: "Release ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; release_id: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.repos.deleteRelease({
          owner: params.owner, repo: params.repo, release_id: params.release_id,
        });
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
