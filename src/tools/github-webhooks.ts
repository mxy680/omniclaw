import { Type } from "@sinclair/typebox";
import type { GitHubClientManager } from "../auth/github-client-manager.js";
import { jsonResult, authRequired, handleApiError } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubWebhookListTool(manager: GitHubClientManager): any {
  return {
    name: "github_webhook_list",
    label: "GitHub List Webhooks",
    description: "List webhooks for a repository.",
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
        const { data } = await octokit.rest.repos.listWebhooks({
          owner: params.owner, repo: params.repo,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((w) => ({
            id: w.id, name: w.name, active: w.active, events: w.events,
            config: { url: w.config.url, content_type: w.config.content_type },
            created_at: w.created_at, updated_at: w.updated_at,
          })),
        );
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubWebhookCreateTool(manager: GitHubClientManager): any {
  return {
    name: "github_webhook_create",
    label: "GitHub Create Webhook",
    description: "Create a webhook for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      url: Type.String({ description: "Payload URL." }),
      content_type: Type.Optional(
        Type.Union([Type.Literal("json"), Type.Literal("form")], {
          description: "Content type.", default: "json",
        }),
      ),
      secret: Type.Optional(Type.String({ description: "Webhook secret." })),
      events: Type.Optional(Type.Array(Type.String(), { description: "Events to subscribe to. Default: ['push']." })),
      active: Type.Optional(Type.Boolean({ description: "Whether the webhook is active.", default: true })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string; repo: string; url: string; content_type?: string;
        secret?: string; events?: string[]; active?: boolean; account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.repos.createWebhook({
          owner: params.owner, repo: params.repo,
          config: {
            url: params.url,
            content_type: params.content_type ?? "json",
            secret: params.secret,
          },
          events: params.events ?? ["push"],
          active: params.active ?? true,
        });
        return jsonResult({ id: data.id, active: data.active, events: data.events, config: { url: data.config.url } });
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubWebhookUpdateTool(manager: GitHubClientManager): any {
  return {
    name: "github_webhook_update",
    label: "GitHub Update Webhook",
    description: "Update an existing webhook.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      hook_id: Type.Number({ description: "Webhook ID." }),
      url: Type.Optional(Type.String({ description: "New payload URL." })),
      content_type: Type.Optional(
        Type.Union([Type.Literal("json"), Type.Literal("form")], { description: "Content type." }),
      ),
      secret: Type.Optional(Type.String({ description: "New webhook secret." })),
      events: Type.Optional(Type.Array(Type.String(), { description: "Events to subscribe to." })),
      active: Type.Optional(Type.Boolean({ description: "Whether the webhook is active." })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        owner: string; repo: string; hook_id: number; url?: string;
        content_type?: string; secret?: string; events?: string[]; active?: boolean; account?: string;
      },
    ) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const config: Record<string, string> = {};
        if (params.url) config.url = params.url;
        if (params.content_type) config.content_type = params.content_type;
        if (params.secret) config.secret = params.secret;

        const { data } = await octokit.rest.repos.updateWebhook({
          owner: params.owner, repo: params.repo, hook_id: params.hook_id,
          config: Object.keys(config).length > 0 ? config : undefined,
          events: params.events, active: params.active,
        });
        return jsonResult({ id: data.id, active: data.active, events: data.events });
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubWebhookDeleteTool(manager: GitHubClientManager): any {
  return {
    name: "github_webhook_delete",
    label: "GitHub Delete Webhook",
    description: "Delete a webhook from a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      hook_id: Type.Number({ description: "Webhook ID." }),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { owner: string; repo: string; hook_id: number; account?: string }) {
      const account = params.account ?? "default";
      const gh = manager.getClient(account);
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        await octokit.rest.repos.deleteWebhook({
          owner: params.owner, repo: params.repo, hook_id: params.hook_id,
        });
        return jsonResult({ success: true });
      } catch (err: unknown) {
        return handleApiError(err, "github");
      }
    },
  };
}
