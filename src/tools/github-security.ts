import { Type } from "@sinclair/typebox";
import type { GitHubClient } from "../auth/github-client.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("github");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubDependabotAlertsTool(gh: GitHubClient): any {
  return {
    name: "github_dependabot_alerts",
    label: "GitHub Dependabot Alerts",
    description: "List Dependabot alerts for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("auto_dismissed"), Type.Literal("dismissed"), Type.Literal("fixed"), Type.Literal("open")],
          { description: "Filter by state." },
        ),
      ),
      severity: Type.Optional(
        Type.Union(
          [Type.Literal("low"), Type.Literal("medium"), Type.Literal("high"), Type.Literal("critical")],
          { description: "Filter by severity." },
        ),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; state?: string; severity?: string; per_page?: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.dependabot.listAlertsForRepo({
          owner: params.owner, repo: params.repo,
          state: params.state as "open" | undefined,
          severity: params.severity as "low" | undefined,
          per_page: params.per_page ?? 30,
        });
        return jsonResult(
          data.map((a) => ({
            number: a.number, state: a.state,
            dependency: { package_name: a.dependency?.package?.name, ecosystem: a.dependency?.package?.ecosystem },
            security_advisory: {
              summary: a.security_advisory.summary,
              severity: a.security_advisory.severity,
            },
            html_url: a.html_url, created_at: a.created_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubCodeScanningAlertsTool(gh: GitHubClient): any {
  return {
    name: "github_code_scanning_alerts",
    label: "GitHub Code Scanning Alerts",
    description: "List code scanning alerts for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("open"), Type.Literal("closed"), Type.Literal("dismissed"), Type.Literal("fixed")],
          { description: "Filter by state." },
        ),
      ),
      severity: Type.Optional(
        Type.Union(
          [Type.Literal("critical"), Type.Literal("high"), Type.Literal("medium"),
           Type.Literal("low"), Type.Literal("warning"), Type.Literal("note"), Type.Literal("error")],
          { description: "Filter by severity." },
        ),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; state?: string; severity?: string; per_page?: number; page?: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.codeScanning.listAlertsForRepo({
          owner: params.owner, repo: params.repo,
          state: params.state as "open" | undefined,
          severity: params.severity as "critical" | undefined,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((a) => ({
            number: a.number, state: a.state,
            rule: { id: a.rule.id, severity: a.rule.severity, description: a.rule.description },
            tool: { name: a.tool.name },
            html_url: a.html_url, created_at: a.created_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubSecretScanningAlertsTool(gh: GitHubClient): any {
  return {
    name: "github_secret_scanning_alerts",
    label: "GitHub Secret Scanning Alerts",
    description: "List secret scanning alerts for a repository.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("open"), Type.Literal("resolved")],
          { description: "Filter by state." },
        ),
      ),
      per_page: Type.Optional(Type.Number({ description: "Results per page.", default: 30 })),
      page: Type.Optional(Type.Number({ description: "Page number.", default: 1 })),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; state?: string; per_page?: number; page?: number },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.secretScanning.listAlertsForRepo({
          owner: params.owner, repo: params.repo,
          state: params.state as "open" | undefined,
          per_page: params.per_page ?? 30, page: params.page ?? 1,
        });
        return jsonResult(
          data.map((a) => ({
            number: a.number, state: a.state,
            secret_type: a.secret_type, secret_type_display_name: a.secret_type_display_name,
            html_url: a.html_url, created_at: a.created_at, resolved_at: a.resolved_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGitHubSecurityAdvisoriesTool(gh: GitHubClient): any {
  return {
    name: "github_security_advisories",
    label: "GitHub Security Advisories",
    description: "List repository security advisories.",
    parameters: Type.Object({
      owner: Type.String({ description: "Repository owner." }),
      repo: Type.String({ description: "Repository name." }),
      state: Type.Optional(
        Type.Union(
          [Type.Literal("triage"), Type.Literal("draft"), Type.Literal("published"), Type.Literal("closed")],
          { description: "Filter by state." },
        ),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { owner: string; repo: string; state?: string },
    ) {
      if (!gh.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      const octokit = gh.getClient();
      try {
        const { data } = await octokit.rest.securityAdvisories.listRepositoryAdvisories({
          owner: params.owner, repo: params.repo,
          state: params.state as "triage" | undefined,
        });
        return jsonResult(
          data.map((a) => ({
            ghsa_id: a.ghsa_id, summary: a.summary, severity: a.severity,
            state: a.state, html_url: a.html_url,
            published_at: a.published_at, created_at: a.created_at,
          })),
        );
      } catch (err: unknown) {
        return jsonResult({ error: "operation_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
