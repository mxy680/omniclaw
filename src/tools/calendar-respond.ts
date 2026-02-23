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
export function createCalendarRespondTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_respond",
    label: "Calendar RSVP",
    description:
      "RSVP to a Google Calendar event invite. Set your response to 'accepted', 'declined', or 'tentative'.",
    parameters: Type.Object({
      event_id: Type.String({ description: "The Google Calendar event ID to respond to." }),
      response: Type.Union(
        [
          Type.Literal("accepted"),
          Type.Literal("declined"),
          Type.Literal("tentative"),
        ],
        { description: "Your RSVP response: 'accepted', 'declined', or 'tentative'." }
      ),
      calendar_id: Type.Optional(
        Type.String({ description: "Calendar ID the event belongs to. Defaults to 'primary'.", default: "primary" })
      ),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { event_id: string; response: "accepted" | "declined" | "tentative"; calendar_id?: string; account?: string }
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const calendar = google.calendar({ version: "v3", auth: client });

      // Fetch the event to find the self attendee entry
      const evRes = await calendar.events.get({
        calendarId: params.calendar_id ?? "primary",
        eventId: params.event_id,
      });

      const attendees = evRes.data.attendees ?? [];
      const selfAttendee = attendees.find((a) => a.self);

      if (!selfAttendee) {
        return jsonResult({
          error: "not_an_attendee",
          message: "You are not listed as an attendee on this event.",
        });
      }

      const updatedAttendees = attendees.map((a) =>
        a.self ? { ...a, responseStatus: params.response } : a
      );

      await calendar.events.patch({
        calendarId: params.calendar_id ?? "primary",
        eventId: params.event_id,
        sendUpdates: "all",
        requestBody: { attendees: updatedAttendees },
      });

      return jsonResult({
        success: true,
        event_id: params.event_id,
        response: params.response,
      });
    },
  };
}
