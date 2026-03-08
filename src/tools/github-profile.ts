import { Type } from "@sinclair/typebox";
import type { GitHubClient } from "../auth/github-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubUserUpdateTool(gh: GitHubClient): any {
  return {
    name: "github_user_update",
    label: "GitHub Update Profile",
    description: "Update the authenticated user's profile (bio, name, location, blog, company, etc.).",
    parameters: Type.Object({
      name: Type.Optional(Type.String({ description: "Display name." })),
      bio: Type.Optional(Type.String({ description: "Short biography." })),
      blog: Type.Optional(Type.String({ description: "Blog URL." })),
      company: Type.Optional(Type.String({ description: "Company name." })),
      location: Type.Optional(Type.String({ description: "Location." })),
      twitter_username: Type.Optional(Type.String({ description: "Twitter username (without @)." })),
      hireable: Type.Optional(Type.Boolean({ description: "Whether the user is hireable." })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        name?: string; bio?: string; blog?: string; company?: string;
        location?: string; twitter_username?: string; hireable?: boolean;
      },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.users.updateAuthenticated(params);
        return jsonResult({
          login: data.login, name: data.name, bio: data.bio, company: data.company,
          location: data.location, blog: data.blog, twitter_username: data.twitter_username,
          hireable: data.hireable, html_url: data.html_url,
        });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubUserFollowersListTool(gh: GitHubClient): any {
  return {
    name: "github_user_followers_list",
    label: "GitHub List Followers",
    description: "List followers of the authenticated user.",
    parameters: Type.Object({
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(_toolCallId: string, params: { per_page?: number; page?: number }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.users.listFollowersForAuthenticatedUser({
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(data.map((u) => ({ login: u.login, html_url: u.html_url, avatar_url: u.avatar_url })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubUserFollowingListTool(gh: GitHubClient): any {
  return {
    name: "github_user_following_list",
    label: "GitHub List Following",
    description: "List users the authenticated user is following.",
    parameters: Type.Object({
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(_toolCallId: string, params: { per_page?: number; page?: number }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.users.listFollowedByAuthenticatedUser({
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(data.map((u: { login: string; html_url: string; avatar_url: string }) => ({ login: u.login, html_url: u.html_url, avatar_url: u.avatar_url })));
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubUserFollowTool(gh: GitHubClient): any {
  return {
    name: "github_user_follow",
    label: "GitHub Follow User",
    description: "Follow a GitHub user.",
    parameters: Type.Object({
      username: Type.String({ description: "GitHub username to follow." }),
    }),
    async execute(_toolCallId: string, params: { username: string }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.users.follow({ username: params.username });
        return jsonResult({ followed: params.username });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubUserUnfollowTool(gh: GitHubClient): any {
  return {
    name: "github_user_unfollow",
    label: "GitHub Unfollow User",
    description: "Unfollow a GitHub user.",
    parameters: Type.Object({
      username: Type.String({ description: "GitHub username to unfollow." }),
    }),
    async execute(_toolCallId: string, params: { username: string }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.users.unfollow({ username: params.username });
        return jsonResult({ unfollowed: params.username });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubUserEventsListTool(gh: GitHubClient): any {
  return {
    name: "github_user_events_list",
    label: "GitHub User Events",
    description: "List recent public events for a GitHub user.",
    parameters: Type.Object({
      username: Type.String({ description: "GitHub username." }),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(_toolCallId: string, params: { username: string; per_page?: number; page?: number }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.activity.listPublicEventsForUser({
          username: params.username,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((e) => ({
            id: e.id, type: e.type, repo: e.repo?.name,
            created_at: e.created_at, public: e.public,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubRepoTopicsReplaceTool(gh: GitHubClient): any {
  return {
    name: "github_repo_topics_replace",
    label: "GitHub Replace Repo Topics",
    description: "Replace all topics (tags) on a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      names: Type.Array(Type.String(), { description: "Array of topic names to set." }),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; names: string[] }) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.replaceAllTopics({
          owner: params.owner, repo: params.repo, names: params.names,
        });
        return jsonResult({ topics: data.names });
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
