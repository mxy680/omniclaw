import { Type } from "@sinclair/typebox";
import type { LinkedInClientManager } from "../auth/linkedin-client-manager.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call linkedin_auth_setup to authenticate with LinkedIn first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLinkedInNotificationsTool(linkedinManager: LinkedInClientManager): any {
  return {
    name: "linkedin_notifications",
    label: "LinkedIn Notifications",
    description: "List your LinkedIn notifications. Returns recent notification cards with headline text and timestamps.",
    parameters: Type.Object({
      count: Type.Optional(
        Type.Number({
          description: "Number of notifications to retrieve (default 20, max 50).",
          default: 20,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "LinkedIn account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { count?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!linkedinManager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }
      try {
        const count = Math.min(params.count ?? 20, 50);
        const data = (await linkedinManager.get(
          account,
          "voyagerIdentityDashNotificationCards",
          {
            decorationId:
              "com.linkedin.voyager.dash.deco.identity.notifications.CardsCollectionWithInjectionsNoPills-24",
            count: String(count),
            q: "filterVanityName",
          },
        )) as { included?: Array<Record<string, unknown>>; data?: Record<string, unknown> };

        const cards = (data.included ?? []).filter(
          (item) =>
            typeof item.$type === "string" &&
            ((item.$type as string).includes("NotificationCard") ||
              (item.$type as string).includes("Notification")),
        );

        const notifications = cards.map((card) => ({
          entityUrn: card.entityUrn,
          headline:
            (card.headline as Record<string, unknown>)?.text ?? card.headline ?? null,
          subHeadline:
            (card.subHeadline as Record<string, unknown>)?.text ?? card.subHeadline ?? null,
          publishedAt: card.publishedAt,
          read: card.read,
          trackingId: card.trackingId,
        }));

        return jsonResult({ count: notifications.length, notifications });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
