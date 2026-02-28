import { Type } from "@sinclair/typebox";
import type { DevpostClientManager } from "../auth/devpost-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./devpost-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDevpostGetProfileTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_get_profile",
    label: "Devpost Get Profile",
    description:
      "Get a Devpost user's profile including name, bio, skills, project count, hackathon count, and social links. Defaults to the authenticated user. Auth required.",
    parameters: Type.Object({
      username: Type.Optional(
        Type.String({
          description:
            "Devpost username. Omit to get the authenticated user's profile.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { username?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;
        const username = params.username ?? session.username;

        if (!username || username === "unknown") {
          return jsonResult({
            error: "No username available. Pass a username parameter or re-authenticate with devpost_auth_setup.",
          });
        }

        const html = (await manager.get(account, `/${username}`)) as string;

        const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        const name = nameMatch ? nameMatch[1].trim() : username;

        const bioMatch = html.match(/class="[^"]*bio[^"]*"[^>]*>([^<]+)</i);
        const bio = bioMatch ? bioMatch[1].trim() : "";

        const locationMatch = html.match(/class="[^"]*location[^"]*"[^>]*>([^<]+)</i);
        const location = locationMatch ? locationMatch[1].trim() : "";

        const statsRegex = /(\d+)\s*<\/?\w[^>]*>\s*(Projects?|Hackathons?|Achievements?|Followers?|Following|Likes?)/gi;
        const stats: Record<string, number> = {};
        let statMatch;
        while ((statMatch = statsRegex.exec(html)) !== null) {
          stats[statMatch[2].toLowerCase()] = parseInt(statMatch[1], 10);
        }

        const skillsRegex = /class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/span>/gi;
        const skills: string[] = [];
        let skillMatch;
        while ((skillMatch = skillsRegex.exec(html)) !== null) {
          skills.push(skillMatch[1].trim());
        }

        return jsonResult({
          username,
          name,
          bio,
          location,
          url: `https://devpost.com/${username}`,
          stats,
          skills: skills.length > 0 ? skills : undefined,
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
export function createDevpostMyHackathonsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_my_hackathons",
    label: "Devpost My Hackathons",
    description:
      "List hackathons the authenticated user has registered for or participated in. Auth required.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;
        const username = session.username;

        if (!username || username === "unknown") {
          return jsonResult({
            error: "No username available. Re-authenticate with devpost_auth_setup.",
          });
        }

        const html = (await manager.get(
          account,
          `/${username}/challenges`,
        )) as string;

        const hackathons: Array<Record<string, unknown>> = [];
        const hackRegex =
          /href="(https:\/\/[^"]*\.devpost\.com[^"]*)"[^>]*>[\s\S]*?<h[2-6][^>]*>([^<]+)<\/h[2-6]>/gi;
        let match;
        while ((match = hackRegex.exec(html)) !== null) {
          hackathons.push({
            url: match[1].trim(),
            title: match[2].trim(),
          });
        }

        return jsonResult({
          username,
          count: hackathons.length,
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
export function createDevpostMyProjectsTool(manager: DevpostClientManager): any {
  return {
    name: "devpost_my_projects",
    label: "Devpost My Projects",
    description:
      "List the authenticated user's submitted projects on Devpost. Auth required.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const session = manager.getCredentials(account)!;
        const username = session.username;

        if (!username || username === "unknown") {
          return jsonResult({
            error: "No username available. Re-authenticate with devpost_auth_setup.",
          });
        }

        const html = (await manager.get(account, `/${username}`)) as string;

        const projects: Array<Record<string, unknown>> = [];
        const projectRegex =
          /href="(https:\/\/devpost\.com\/software\/[^"]+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)<\/h5>[\s\S]*?<p[^>]*>([^<]*)<\/p>/gi;
        let match;
        while ((match = projectRegex.exec(html)) !== null) {
          projects.push({
            url: match[1].trim(),
            title: match[2].trim(),
            tagline: match[3].trim(),
            slug: match[1]
              .replace("https://devpost.com/software/", "")
              .replace(/\/$/, ""),
          });
        }

        if (projects.length === 0) {
          const simpleRegex =
            /href="(https:\/\/devpost\.com\/software\/[^"]+)"[^>]*>[\s\S]*?<h5[^>]*>([^<]+)<\/h5>/gi;
          while ((match = simpleRegex.exec(html)) !== null) {
            projects.push({
              url: match[1].trim(),
              title: match[2].trim(),
              slug: match[1]
                .replace("https://devpost.com/software/", "")
                .replace(/\/$/, ""),
            });
          }
        }

        return jsonResult({
          username,
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
