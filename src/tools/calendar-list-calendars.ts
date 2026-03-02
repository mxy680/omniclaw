import { Type } from "@sinclair/typebox";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("gmail");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCalendarListCalendarsTool(clientManager: OAuthClientManager): any {
  return {
    name: "calendar_list_calendars",
    label: "Calendar List Calendars",
    description:
      "List all Google Calendars the user has access to (primary, shared, subscribed). Returns id, summary, and whether each is the primary calendar.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name to use. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(_toolCallId: string, params: { account?: string }) {
      const account = params.account ?? "default";
      if (!clientManager.listAccounts().includes(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      const client = clientManager.getClient(account);
      const calendar = google.calendar({ version: "v3", auth: client });

      const res = await calendar.calendarList.list();
      const items = (res.data.items ?? []).map((cal) => ({
        id: cal.id ?? "",
        summary: cal.summary ?? "",
        description: cal.description ?? "",
        primary: cal.primary ?? false,
        timeZone: cal.timeZone ?? "",
      }));

      return jsonResult(items);
    },
  };
}
