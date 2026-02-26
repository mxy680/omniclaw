import { Type } from "@sinclair/typebox";
import type { Factor75ClientManager } from "../auth/factor75-client-manager.js";
import { jsonResult, AUTH_REQUIRED, formatDelivery } from "./factor75-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75DeliveriesTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_deliveries",
    label: "Factor75 Deliveries",
    description:
      "List upcoming and recent Factor75 deliveries. Shows delivery dates, statuses, tracking info, and meal lists.",
    parameters: Type.Object({
      range_weeks: Type.Optional(
        Type.Number({
          description:
            "Number of weeks to look ahead/behind from the current week (default 6). The API uses rangeStart/rangeEnd week identifiers.",
          default: 6,
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Factor75 account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { range_weeks?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const rangeWeeks = Math.min(params.range_weeks ?? 6, 26);

        // Compute ISO week identifiers for rangeStart (2 weeks ago) and rangeEnd.
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 14); // 2 weeks back
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + rangeWeeks * 7);

        const toISOWeek = (d: Date): string => {
          // ISO 8601 week number calculation
          const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
          tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
          const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
          const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
          return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
        };

        // GET /gw/api/customers/me/deliveries?rangeStart=YYYY-Www&rangeEnd=YYYY-Www
        const data = (await manager.get(account, "api/customers/me/deliveries", {
          rangeStart: toISOWeek(startDate),
          rangeEnd: toISOWeek(endDate),
        })) as {
          count?: number;
          items?: Array<Record<string, unknown>>;
          deliveries?: Array<Record<string, unknown>>;
        };

        const rawDeliveries = data.items ?? data.deliveries ?? [];
        const deliveries = rawDeliveries.map(formatDelivery);

        return jsonResult({
          range_start: toISOWeek(startDate),
          range_end: toISOWeek(endDate),
          count: deliveries.length,
          deliveries,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75DeliveryDetailsTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_delivery_details",
    label: "Factor75 Delivery Details",
    description:
      "Get full details for a specific Factor75 delivery — tracking info, all meals with nutrition, delivery address, and status.",
    parameters: Type.Object({
      delivery_id: Type.String({
        description: "The delivery ID to get details for.",
      }),
      account: Type.Optional(
        Type.String({
          description: "Factor75 account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { delivery_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        // GET /gw/api/customers/me/deliveries/{id}
        const delivery = (await manager.get(
          account,
          `api/customers/me/deliveries/${params.delivery_id}`,
        )) as Record<string, unknown>;

        if (!delivery || Object.keys(delivery).length === 0) {
          return jsonResult({ error: "Delivery not found", delivery_id: params.delivery_id });
        }

        return jsonResult(formatDelivery(delivery));
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
