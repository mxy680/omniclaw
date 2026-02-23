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
export function createCalendarDeleteTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_delete",
    label: "Calendar Delete Event",
    description:
      "Delete (cancel) a Google Calendar event by its ID. Sends cancellation notifications to all attendees.",
    parameters: Type.Object({
      event_id: Type.String({ description: "The Google Calendar event ID to delete." }),
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

      await calendar.events.delete({
        calendarId: params.calendar_id ?? "primary",
        eventId: params.event_id,
        sendUpdates: "all",
      });

      return jsonResult({ success: true, event_id: params.event_id });
    },
  };
}
