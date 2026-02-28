import { Type } from "@sinclair/typebox";
import { DevpostClientManager } from "../auth/devpost-client-manager.js";
import { jsonResult } from "./devpost-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostSearchProjectsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_search_projects",
    label: "Devpost Search Projects",
    description:
      "Search software projects on Devpost by keyword. No authentication required.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query for project name or description." }),
      sort: Type.Optional(
        Type.String({
          description: "Sort order: 'Newest', 'Popular', 'Trending'. Default 'Popular'.",
          default: "Popular",
        }),
      ),
      page: Type.Optional(
        Type.Number({ description: "Page number (default 1).", default: 1 }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; sort?: string; page?: number },
    ) {
      try {
        const queryParams: Record<string, string> = {
          query: params.query,
        };
        if (params.sort) queryParams.sort = params.sort;
        if (params.page) queryParams.page = String(params.page);

        const data = await DevpostClientManager.searchProjects(queryParams);

        const projects = data.software.map((s) => ({
          url: s.url,
          title: (s.name as string)?.trim(),
          tagline: (s.tagline as string)?.trim(),
          slug: s.slug,
          members: s.members,
          tags: s.tags,
          winner: s.winner,
          has_video: s.has_video,
          like_count: s.like_count,
          comment_count: s.comment_count,
        }));

        return jsonResult({
          query: params.query,
          page: params.page ?? 1,
          total: data.total_count,
          count: projects.length,
          projects,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostGetProjectTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_get_project",
    label: "Devpost Get Project",
    description:
      "Get full details for a software project including description, tech stack, team members, demo link, and media. Pass a project URL or slug.",
    parameters: Type.Object({
      project: Type.String({
        description:
          "Project URL (e.g. 'https://devpost.com/software/myproject') or slug (e.g. 'myproject').",
      }),
    }),
    async execute(_toolCallId: string, params: { project: string }) {
      try {
        let url: string;
        if (params.project.startsWith("http")) {
          url = params.project;
        } else {
          url = `https://devpost.com/software/${params.project}`;
        }

        const resp = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to fetch project: ${resp.status} ${resp.statusText}`);
        }

        const html = await resp.text();

        const titleMatch = html.match(/<h1[^>]*id="app-title"[^>]*>([^<]+)<\/h1>/) ??
          html.match(/<title>([^<|]+)/);
        const title = titleMatch ? titleMatch[1].trim() : "Unknown";

        const taglineMatch = html.match(/<p[^>]*id="app-tagline"[^>]*>([^<]+)<\/p>/);
        const tagline = taglineMatch ? taglineMatch[1].trim() : "";

        const builtWithRegex = /Built\s+[Ww]ith[\s\S]*?<span[^>]*class="[^"]*cp-tag[^"]*"[^>]*>([^<]+)<\/span>/gi;
        const builtWith: string[] = [];
        let bwMatch;
        while ((bwMatch = builtWithRegex.exec(html)) !== null) {
          builtWith.push(bwMatch[1].trim());
        }

        const descMatch = html.match(
          /id="app-details-left"[^>]*>([\s\S]*?)(?=<\/div>\s*<\/div>\s*<div[^>]*id="app-details-right")/,
        );
        let description = "";
        if (descMatch) {
          description = descMatch[1]
            .replace(/<[^>]+>/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, 2000);
        }

        const teamRegex = /class="[^"]*user-profile[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi;
        const team: string[] = [];
        let teamMatch;
        while ((teamMatch = teamRegex.exec(html)) !== null) {
          team.push(teamMatch[1].trim());
        }

        const demoMatch = html.match(/href="([^"]*)"[^>]*class="[^"]*app-links[^"]*"/);
        const demoUrl = demoMatch ? demoMatch[1] : undefined;

        const hackathonMatch = html.match(
          /href="(https:\/\/[^"]*\.devpost\.com[^"]*)"[^>]*>[^<]*<[^>]*>[^<]*hackathon/i,
        ) ?? html.match(/href="(https:\/\/[^"]*\.devpost\.com\/?)"[^>]*>/);
        const hackathonUrl = hackathonMatch ? hackathonMatch[1] : undefined;

        return jsonResult({
          title,
          tagline,
          url,
          description,
          built_with: builtWith.length > 0 ? builtWith : undefined,
          team: team.length > 0 ? team : undefined,
          demo_url: demoUrl,
          hackathon_url: hackathonUrl,
        });
      } catch (err) {
        return jsonResult({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
