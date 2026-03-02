import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCalendarFreeBusyTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_freebusy",
    label: "Calendar Free/Busy",
    description: "Check free/busy availability for one or more calendars in a time range.",
    parameters: Type.Object({
      time_min: Type.String({ description: "Start of time range (ISO 8601)." }),
      time_max: Type.String({ description: "End of time range (ISO 8601)." }),
      calendars: Type.Optional(
        Type.Array(Type.String(), { description: "Calendar IDs to check. Defaults to ['primary']." }),
      ),
      account: Type.Optional(Type.String({ description: "Account name. Defaults to 'default'.", default: "default" })),
    }),
    async execute(_toolCallId: string, params: {
      time_min: string; time_max: string; calendars?: string[]; account?: string;
    }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) return jsonResult(AUTH_REQUIRED);

      const client = clientManager.getClient(account);
      const calendar = google.calendar({ version: "v3", auth: client });
      const calendarIds = params.calendars ?? ["primary"];

      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: params.time_min,
          timeMax: params.time_max,
          items: calendarIds.map((id) => ({ id })),
        },
      });

      const result: Record<string, { busy: Array<{ start: string; end: string }> }> = {};
      for (const [calId, data] of Object.entries(res.data.calendars ?? {})) {
        result[calId] = {
          busy: ((data as any).busy ?? []).map((b: any) => ({ start: b.start, end: b.end })),
        };
      }

      return jsonResult({ timeMin: params.time_min, timeMax: params.time_max, calendars: result });
    },
  };
}
