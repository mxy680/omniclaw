import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager";

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
export function createCalendarGetTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_get",
    label: "Calendar Get Event",
    description:
      "Fetch full details of a single Google Calendar event by its ID. Returns summary, description, location, start/end time, attendees, and meeting link.",
    parameters: Type.Object({
      event_id: Type.String({ description: "The Google Calendar event ID." }),
      calendar_id: Type.Optional(
        Type.String({ description: "Calendar ID the event belongs to. Defaults to 'primary'.", default: "primary" })
      ),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(_toolCallId: string, params: { event_id: string; calendar_id?: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const calendar = google.calendar({ version: "v3", auth: client });

      const res = await calendar.events.get({
        calendarId: params.calendar_id ?? "primary",
        eventId: params.event_id,
      });

      const ev = res.data;
      return jsonResult({
        id: ev.id ?? "",
        summary: ev.summary ?? "(No title)",
        description: ev.description ?? "",
        location: ev.location ?? "",
        start: ev.start?.dateTime ?? ev.start?.date ?? "",
        end: ev.end?.dateTime ?? ev.end?.date ?? "",
        status: ev.status ?? "",
        organizer: ev.organizer?.email ?? "",
        attendees: (ev.attendees ?? []).map((a) => ({
          email: a.email ?? "",
          displayName: a.displayName ?? "",
          responseStatus: a.responseStatus ?? "",
          self: a.self ?? false,
        })),
        conferenceData: ev.conferenceData
          ? {
              type: ev.conferenceData.conferenceSolution?.name ?? "",
              joinUrl:
                ev.conferenceData.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri ?? "",
            }
          : null,
        htmlLink: ev.htmlLink ?? "",
        recurringEventId: ev.recurringEventId ?? null,
      });
    },
  };
}
