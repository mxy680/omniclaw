import { Type } from "@sinclair/typebox";
import type { CronometerClientManager } from "../auth/cronometer-client-manager.js";
import { jsonResult, AUTH_REQUIRED, parseCsv, formatBiometric, todayStr, daysAgoStr } from "./cronometer-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCronometerBiometricsTool(manager: CronometerClientManager): any {
  return {
    name: "cronometer_biometrics",
    label: "Cronometer Biometrics",
    description:
      "Get biometric measurements from Cronometer for a date range. Returns measurements like weight, blood pressure, body fat %, etc. Defaults to the last 30 days.",
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
        const csv = await manager.export(account, "biometrics", start, end);
        const rows = parseCsv(csv);
        const biometrics = rows.map(formatBiometric);

        return jsonResult({ start, end, count: biometrics.length, biometrics });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
