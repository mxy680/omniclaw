import { Type } from "@sinclair/typebox";
import type { CronometerClientManager } from "../auth/cronometer-client-manager.js";
import { jsonResult, AUTH_REQUIRED, parseCsv, formatExercise, todayStr, daysAgoStr } from "./cronometer-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCronometerExercisesTool(manager: CronometerClientManager): any {
  return {
    name: "cronometer_exercises",
    label: "Cronometer Exercises",
    description:
      "Get the exercise log from Cronometer for a date range. Returns exercises with duration and calories burned. Defaults to the last 7 days.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.String({ description: "Start date (YYYY-MM-DD). Defaults to 7 days ago." }),
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
        const start = params.start ?? daysAgoStr(7);
        const end = params.end ?? todayStr();
        const csv = await manager.export(account, "exercises", start, end);
        const rows = parseCsv(csv);
        const exercises = rows.map(formatExercise);

        return jsonResult({ start, end, count: exercises.length, exercises });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
