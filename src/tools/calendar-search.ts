import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCalendarSearchTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_search",
    label: "Calendar Search Events",
    description: "Search for calendar events by text query across titles and descriptions.",
    parameters: Type.Object({
      query: Type.String({ description: "Text to search for in event titles and descriptions." }),
      calendar_id: Type.Optional(Type.String({ description: "Calendar ID. Defaults to 'primary'.", default: "primary" })),
      time_min: Type.Optional(Type.String({ description: "Lower bound (ISO 8601). Defaults to now." })),
      time_max: Type.Optional(Type.String({ description: "Upper bound (ISO 8601)." })),
      max_results: Type.Optional(Type.Number({ description: "Max results. Defaults to 20.", default: 20 })),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: {
      query: string; calendar_id?: string; time_min?: string; time_max?: string;
      max_results?: number; account?: string;
    }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);

      const client = clientManager.getClient(account);
      const calendar = google.calendar({ version: "v3", auth: client });

      const res = await calendar.events.list({
        calendarId: params.calendar_id ?? "primary",
        q: params.query,
        timeMin: params.time_min ?? new Date().toISOString(),
        ...(params.time_max ? { timeMax: params.time_max } : {}),
        maxResults: params.max_results ?? 20,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = (res.data.items ?? []).map((ev) => ({
        id: ev.id ?? "",
        summary: ev.summary ?? "",
        start: ev.start?.dateTime ?? ev.start?.date ?? "",
        end: ev.end?.dateTime ?? ev.end?.date ?? "",
        status: ev.status ?? "",
        location: ev.location ?? "",
        htmlLink: ev.htmlLink ?? "",
      }));

      return jsonResult(events);
    },
  };
}
