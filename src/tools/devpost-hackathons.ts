import { Type } from "@sinclair/typebox";
import { DevpostClientManager } from "../auth/devpost-client-manager.js";
import { jsonResult } from "./devpost-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostSearchHackathonsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_search_hackathons",
    label: "Devpost Search Hackathons",
    description:
      "Search and browse hackathons on Devpost. Supports filtering by status (open, upcoming, ended), themes, and location. No authentication required.",
    parameters: Type.Object({
      status: Type.Optional(
        Type.String({
          description:
            "Filter by status: 'open', 'upcoming', 'ended'. Omit for all.",
        }),
      ),
      search: Type.Optional(
        Type.String({ description: "Search query for hackathon name or description." }),
      ),
      themes: Type.Optional(
        Type.String({
          description: "Comma-separated theme IDs to filter by.",
        }),
      ),
      location: Type.Optional(
        Type.String({ description: "Filter by location (e.g. 'Online', 'San Francisco')." }),
      ),
      page: Type.Optional(
        Type.Number({ description: "Page number (default 1).", default: 1 }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        status?: string;
        search?: string;
        themes?: string;
        location?: string;
        page?: number;
      },
    ) {
      try {
        const queryParams: Record<string, string> = {};
        if (params.status) queryParams.status = params.status;
        if (params.search) queryParams.search = params.search;
        if (params.themes) queryParams.themes = params.themes;
        if (params.location) queryParams.location = params.location;
        if (params.page) queryParams.page = String(params.page);

        const data = await DevpostClientManager.searchHackathons(queryParams);

        const hackathons = data.hackathons.map((h) => ({
          id: h.id,
          title: h.title,
          url: h.url,
          status: h.open_state,
          location: (h.displayed_location as Record<string, unknown>)?.location ?? "Unknown",
          submission_dates: h.submission_period_dates,
          time_left: h.time_left_to_submission,
          prize_amount: String(h.prize_amount ?? "")
            .replace(/<[^>]*>/g, "")
            .trim(),
          registrations: h.registrations_count,
          organization: h.organization_name,
          themes: (h.themes as Array<{ name: string }>)?.map((t) => t.name) ?? [],
          winners_announced: h.winners_announced,
          featured: h.featured,
          invite_only: h.invite_only,
          submission_gallery_url: h.submission_gallery_url,
        }));

        return jsonResult({
          count: hackathons.length,
          total: data.meta.total_count,
          page: params.page ?? 1,
          hackathons,
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
export function createDevpostGetHackathonTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_get_hackathon",
    label: "Devpost Get Hackathon",
    description:
      "Get full details for a specific hackathon including prizes, rules, judges, timeline, and eligibility. Pass a hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
    parameters: Type.Object({
      hackathon: Type.String({
        description:
          "Hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
      }),
    }),
    async execute(_toolCallId: string, params: { hackathon: string }) {
      try {
        let url: string;
        if (params.hackathon.startsWith("http")) {
          url = params.hackathon.replace(/\/$/, "");
        } else {
          url = `https://${params.hackathon}.devpost.com`;
        }

        const resp = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to fetch hackathon: ${resp.status} ${resp.statusText}`);
        }

        const html = await resp.text();

        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        const title = titleMatch ? titleMatch[1].replace(/ \| Devpost$/, "").trim() : "Unknown";

        const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/) ??
          html.match(/<meta\s+content="([^"]*)"\s+name="description"/);
        const description = descMatch ? descMatch[1].trim() : "";

        const prizesMatch = html.match(/class="[^"]*prizes[^"]*"[^>]*>([\s\S]*?)(?=<\/section|<section)/i);
        const prizesHtml = prizesMatch ? prizesMatch[1] : "";
        const prizeEntries: Array<{ title: string; value: string }> = [];
        const prizeRegex =
          /class="[^"]*prize[^"]*"[^>]*>[\s\S]*?<h[2-6][^>]*>([^<]+)<\/h[2-6]>[\s\S]*?(?:<span[^>]*>([^<]*)<\/span>)?/gi;
        let prizeMatch;
        while ((prizeMatch = prizeRegex.exec(prizesHtml)) !== null) {
          prizeEntries.push({
            title: prizeMatch[1].trim(),
            value: prizeMatch[2]?.trim() ?? "",
          });
        }

        const datesMatch = html.match(/submission_period_dates['"]\s*:\s*['"]([^'"]+)['"]/);
        const dates = datesMatch ? datesMatch[1] : "";

        return jsonResult({
          title,
          url,
          description,
          dates,
          prizes: prizeEntries.length > 0 ? prizeEntries : undefined,
          submission_gallery: `${url}/project-gallery`,
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
export function createDevpostHackathonProjectsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_hackathon_projects",
    label: "Devpost Hackathon Projects",
    description:
      "Browse submitted projects for a specific hackathon. Pass a hackathon URL or slug.",
    parameters: Type.Object({
      hackathon: Type.String({
        description:
          "Hackathon URL (e.g. 'https://example.devpost.com/') or slug (e.g. 'example').",
      }),
      page: Type.Optional(
        Type.Number({ description: "Page number (default 1).", default: 1 }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { hackathon: string; page?: number },
    ) {
      try {
        let baseUrl: string;
        if (params.hackathon.startsWith("http")) {
          baseUrl = params.hackathon.replace(/\/$/, "");
        } else {
          baseUrl = `https://${params.hackathon}.devpost.com`;
        }

        const galleryUrl = `${baseUrl}/project-gallery${params.page && params.page > 1 ? `?page=${params.page}` : ""}`;

        const resp = await fetch(galleryUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });

        if (!resp.ok) {
          throw new Error(`Failed to fetch project gallery: ${resp.status}`);
        }

        const html = await resp.text();

        const projects: Array<Record<string, unknown>> = [];
        const titleRegex =
          /href="(https:\/\/devpost\.com\/software\/[^"]+)"[^>]*>\s*(?:<[^>]*>)*\s*<h5[^>]*>([^<]+)<\/h5>/gi;
        let match;
        while ((match = titleRegex.exec(html)) !== null) {
          projects.push({
            url: match[1].trim(),
            title: match[2].trim(),
            slug: match[1].replace("https://devpost.com/software/", "").replace(/\/$/, ""),
          });
        }

        return jsonResult({
          hackathon: baseUrl,
          page: params.page ?? 1,
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
