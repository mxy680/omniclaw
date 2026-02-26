import { Type } from "@sinclair/typebox";
import type { Factor75ClientManager } from "../auth/factor75-client-manager.js";
import { jsonResult, AUTH_REQUIRED } from "./factor75-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75SubscriptionTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_subscription",
    label: "Factor75 Subscription",
    description:
      "Get Factor75 subscription details — plan, status, meals per week, pricing, next delivery date, and upcoming skipped weeks.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Factor75 account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        // GET /gw/api/customers/me/subscriptions  (returns full subscription list)
        const subData = (await manager.get(account, "api/customers/me/subscriptions")) as {
          count?: number;
          items?: Array<Record<string, unknown>>;
        };

        const sub = subData.items?.[0];
        if (!sub) {
          return jsonResult({ error: "No subscription found." });
        }

        const product = sub.product as Record<string, unknown> | undefined;
        const deliveryOption = sub.deliveryOption as Record<string, unknown> | undefined;
        const shippingAddress = sub.shippingAddress as Record<string, unknown> | undefined;
        const region = (shippingAddress?.region as Record<string, unknown> | undefined);

        return jsonResult({
          id: sub.id,
          status: sub.isActive ? "active" : (sub.endlessPausedAt ? "paused" : "inactive"),
          customer_plan_id: sub.customerPlanId,
          plan: {
            product_sku: product?.sku ?? product?.handle,
          },
          delivery_option: deliveryOption?.handle,
          delivery_day: deliveryOption?.deliveryName,
          shipping_address: shippingAddress
            ? {
                postcode: shippingAddress.postcode,
                city: shippingAddress.city,
                state: region?.code ?? region?.name ?? shippingAddress.state,
              }
            : null,
          next_delivery: sub.nextDelivery,
          next_delivery_week: sub.nextDeliveryWeek,
          next_cutoff_date: sub.nextCutoffDate,
          paused_at: sub.pausedAt ?? sub.endlessPausedAt ?? null,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75SkipWeekTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_skip_week",
    label: "Factor75 Skip Week",
    description:
      "Skip a delivery week on Factor75. The week will not be charged or delivered.",
    parameters: Type.Object({
      week: Type.String({
        description: "Week identifier to skip (e.g. '2026-W09').",
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
      params: { week: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const subParams = await manager.getSubscriptionParams(account);

        // POST /gw/api/customers/me/skips
        const data = (await manager.post(account, "api/customers/me/skips", {
          week: params.week,
          subscriptionId: subParams.subscriptionId,
        })) as {
          success?: boolean;
          skippedWeeks?: string[];
          skipped_weeks?: string[];
          nextDeliveryDate?: string;
          next_delivery_date?: string;
        };

        const skippedWeeks = data.skippedWeeks ?? data.skipped_weeks ?? [];
        const nextDelivery = data.nextDeliveryDate ?? data.next_delivery_date;

        return jsonResult({
          status: "week_skipped",
          week: params.week,
          skipped_weeks: skippedWeeks,
          next_delivery: nextDelivery,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75PauseTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_pause",
    label: "Factor75 Pause Subscription",
    description:
      "Pause the Factor75 subscription. No deliveries will be made until the subscription is resumed. Use with caution — this affects your real subscription.",
    parameters: Type.Object({
      weeks: Type.Optional(
        Type.Number({
          description: "Number of weeks to pause (1-8). If omitted, pauses indefinitely until manually resumed.",
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
      params: { weeks?: number; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const subParams = await manager.getSubscriptionParams(account);

        const body: Record<string, unknown> = {
          subscriptionId: subParams.subscriptionId,
        };
        if (params.weeks) {
          body.weeks = params.weeks;
        }

        // POST /gw/api/customers/me/subscription/pause
        const data = (await manager.post(
          account,
          "api/customers/me/subscription/pause",
          body,
        )) as {
          success?: boolean;
          status?: string;
          pausedUntil?: string;
          paused_until?: string;
        };

        const pausedUntil = data.pausedUntil ?? data.paused_until;

        return jsonResult({
          status: data.success === false ? "pause_failed" : "paused",
          subscription_status: data.status,
          paused_until: pausedUntil,
          weeks: params.weeks ?? "indefinite",
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75ResumeTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_resume",
    label: "Factor75 Resume Subscription",
    description:
      "Resume a paused Factor75 subscription. Deliveries will restart from the next available week.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Factor75 account name. Defaults to 'default'.",
          default: "default",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const subParams = await manager.getSubscriptionParams(account);

        // POST /gw/api/customers/me/subscription/resume
        const data = (await manager.post(
          account,
          "api/customers/me/subscription/resume",
          { subscriptionId: subParams.subscriptionId },
        )) as {
          success?: boolean;
          status?: string;
          nextDeliveryDate?: string;
          next_delivery_date?: string;
        };

        const nextDelivery = data.nextDeliveryDate ?? data.next_delivery_date;

        return jsonResult({
          status: data.success === false ? "resume_failed" : "resumed",
          subscription_status: data.status,
          next_delivery: nextDelivery,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
