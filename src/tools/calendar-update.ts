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
export function createCalendarUpdateTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_update",
    label: "Calendar Update Event",
    description:
      "Update an existing Google Calendar event. Only provide the fields you want to change — unspecified fields are left as-is.",
    parameters: Type.Object({
      event_id: Type.String({ description: "The Google Calendar event ID to update." }),
      summary: Type.Optional(Type.String({ description: "New event title." })),
      start: Type.Optional(Type.String({ description: "New start time as an ISO 8601 datetime string." })),
      end: Type.Optional(Type.String({ description: "New end time as an ISO 8601 datetime string." })),
      description: Type.Optional(Type.String({ description: "New event description." })),
      location: Type.Optional(Type.String({ description: "New location." })),
      calendar_id: Type.Optional(
        Type.String({ description: "Calendar ID the event belongs to. Defaults to 'primary'.", default: "primary" })
      ),
      account: Type.Optional(
        Type.String({ description: "Account name to use. Defaults to 'default'.", default: "default" })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        event_id: string;
        summary?: string;
        start?: string;
        end?: string;
        description?: string;
        location?: string;
        calendar_id?: string;
        account?: string;
      }
    ) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const calendar = google.calendar({ version: "v3", auth: client });

      const patch: Record<string, unknown> = {};
      if (params.summary !== undefined) patch.summary = params.summary;
      if (params.description !== undefined) patch.description = params.description;
      if (params.location !== undefined) patch.location = params.location;
      if (params.start !== undefined) patch.start = { dateTime: params.start };
      if (params.end !== undefined) patch.end = { dateTime: params.end };

      const res = await calendar.events.patch({
        calendarId: params.calendar_id ?? "primary",
        eventId: params.event_id,
        sendUpdates: "all",
        requestBody: patch,
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
