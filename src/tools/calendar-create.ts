import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCalendarCreateTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_create",
    label: "Calendar Create Event",
    description:
      "Create a new Google Calendar event. Provide a title, start and end times as ISO 8601 datetimes (e.g. '2026-03-01T14:00:00-05:00'), and optionally a description, location, and list of attendee email addresses.",
    parameters: Type.Object({
      summary: Type.String({ description: "Event title." }),
      start: Type.String({
        description:
          "Event start time as an ISO 8601 datetime string (e.g. '2026-03-01T14:00:00-05:00').",
      }),
      end: Type.String({
        description:
          "Event end time as an ISO 8601 datetime string (e.g. '2026-03-01T15:00:00-05:00').",
      }),
      description: Type.Optional(Type.String({ description: "Event description or agenda." })),
      location: Type.Optional(Type.String({ description: "Location or meeting room." })),
      attendees: Type.Optional(
        Type.Array(Type.String(), { description: "List of attendee email addresses to invite." }),
      ),
      calendar_id: Type.Optional(
        Type.String({
          description: "Calendar to add the event to. Defaults to 'primary'.",
          default: "primary",
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
        summary: string;
        start: string;
        end: string;
        description?: string;
        location?: string;
        attendees?: string[];
        calendar_id?: string;
        account?: string;
      },
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const calendar = google.calendar({ version: "v3", auth: client });

      const res = await calendar.events.insert({
        calendarId: params.calendar_id ?? "primary",
        sendUpdates: "all",
        requestBody: {
          summary: params.summary,
          description: params.description,
          location: params.location,
          start: { dateTime: params.start },
          end: { dateTime: params.end },
          attendees: params.attendees?.map((email) => ({ email })),
        },
      });

      const ev = res.data;
      return jsonResult({
        id: ev.id ?? "",
        summary: ev.summary ?? "",
        start: ev.start?.dateTime ?? ev.start?.date ?? "",
        end: ev.end?.dateTime ?? ev.end?.date ?? "",
        htmlLink: ev.htmlLink ?? "",
        success: true,
      });
    },
  };
}
