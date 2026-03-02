import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCalendarQuickAddTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_quick_add",
    label: "Calendar Quick Add",
    description: "Create a calendar event from a natural language string (e.g. 'Meeting with Bob tomorrow at 3pm for 1 hour').",
    parameters: Type.Object({
      text: Type.String({ description: "Natural language event description, e.g. 'Lunch with Alice Friday at noon'." }),
      calendar_id: Type.Optional(Type.String({ description: "Calendar ID. Defaults to 'primary'.", default: "primary" })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: { text: string; calendar_id?: string; account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);

      const client = clientManager.getClient(account);
      const calendar = google.calendar({ version: "v3", auth: client });

      const res = await calendar.events.quickAdd({
        calendarId: params.calendar_id ?? "primary",
        text: params.text,
        sendUpdates: "all",
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
