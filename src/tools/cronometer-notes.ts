import { Type } from "@sinclair/typebox";
import type { CronometerClientManager } from "../auth/cronometer-client-manager.js";
import { jsonResult, AUTH_REQUIRED, parseCsv, formatNote, todayStr, daysAgoStr } from "./cronometer-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCronometerNotesTool(manager: CronometerClientManager): any {
  return {
    name: "cronometer_notes",
    label: "Cronometer Notes",
    description:
      "Get daily notes from Cronometer for a date range. Returns notes attached to each day. Defaults to the last 30 days.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to 30 days ago." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date (YYYY-MM-DD). Defaults to today." }),
      ),
      account: Type.Optional(
        Type.String({ description: "Cronometer account name. Defaults to 'default'.", default: "default" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { start?: string; end?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) return jsonResult(AUTH_REQUIRED);

      try {
        const start = params.start ?? daysAgoStr(30);
        const end = params.end ?? todayStr();
        const csv = await manager.export(account, "notes", start, end);
        const rows = parseCsv(csv);
        const notes = rows.map(formatNote);

        return jsonResult({ start, end, count: notes.length, notes });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
