import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";

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
  action: "Call gmail_auth_setup to authenticate.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCalendarEventsTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_events",
    label: "Calendar List Events",
    description:
      "List upcoming Google Calendar events. Defaults to the primary calendar and upcoming events from now. Optionally filter by time range or limit results.",
    parameters: Type.Object({
      calendar_id: Type.Optional(
        Type.String({
          description: "Calendar ID to query. Defaults to 'primary'.",
          default: "primary",
        }),
      ),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of events to return. Defaults to 20.",
          default: 20,
        }),
      ),
      time_min: Type.Optional(
        Type.String({
          description:
            "Lower bound (inclusive) for event start time, as an ISO 8601 datetime. Defaults to now.",
        }),
      ),
      time_max: Type.Optional(
        Type.String({
          description: "Upper bound (exclusive) for event end time, as an ISO 8601 datetime.",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        calendar_id?: string;
        max_results?: number;
        time_min?: string;
        time_max?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const calendar = google.calendar({ version: "v3", auth: client });

      const res = await calendar.events.list({
        calendarId: params.calendar_id ?? "primary",
        maxResults: params.max_results ?? 20,
        singleEvents: true,
        orderBy: "startTime",
        timeMin: params.time_min ?? new Date().toISOString(),
        ...(params.time_max ? { timeMax: params.time_max } : {}),
      });

      const events = (res.data.items ?? []).map((ev) => ({
        id: ev.id ?? "",
        summary: ev.summary ?? "(No title)",
        start: ev.start?.dateTime ?? ev.start?.date ?? "",
        end: ev.end?.dateTime ?? ev.end?.date ?? "",
        status: ev.status ?? "",
        location: ev.location ?? "",
        organizer: ev.organizer?.email ?? "",
        attendees: (ev.attendees ?? []).map((a) => ({
          email: a.email ?? "",
          displayName: a.displayName ?? "",
          responseStatus: a.responseStatus ?? "",
          self: a.self ?? false,
        })),
        htmlLink: ev.htmlLink ?? "",
      }));

      return jsonResult(events);
    },
  };
}
