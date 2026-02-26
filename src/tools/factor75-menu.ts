import { Type } from "@sinclair/typebox";
import type { Factor75ClientManager } from "../auth/factor75-client-manager.js";
import { jsonResult, AUTH_REQUIRED, formatMeal } from "./factor75-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75MenuTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_menu",
    label: "Factor75 Menu",
    description:
      "Get the weekly Factor75 meal menu. Returns available meals with names, descriptions, nutrition info, and tags. Optionally filter by dietary preference.",
    parameters: Type.Object({
      week: Type.Optional(
        Type.String({
          description:
            "Week identifier (e.g. '2026-W09'). Defaults to the current/upcoming week.",
        }),
      ),
      filter: Type.Optional(
        Type.String({
          description:
            "Filter meals by dietary tag (e.g. 'keto', 'calorie-smart', 'protein-plus', 'vegan-veggie', 'chef-choice').",
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
      params: { week?: string; filter?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        // Subscription params are needed to build the menu request correctly.
        const subParams = await manager.getSubscriptionParams(account);

        // GET /gw/my-deliveries/menu — the actual Factor75 menu endpoint.
        // Requires subscription-derived query params.
        const queryParams: Record<string, string> = {
          subscription: String(subParams.subscriptionId),
          customerPlanId: subParams.customerPlanId,
          "product-sku": subParams.productSku,
          "delivery-option": subParams.deliveryOption,
          postcode: subParams.postcode,
          servings: "1",
          "include-future-feedback": "true",
        };
        if (subParams.preference) {
          queryParams.preference = subParams.preference;
        }
        // The week parameter is required by the API. Default to next week.
        if (params.week) {
          queryParams.week = params.week;
        } else {
          const now = new Date();
          // Use the next upcoming week by default
          const next = new Date(now);
          next.setDate(next.getDate() + (7 - now.getDay()) % 7 + 1);
          const tmp = new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()));
          tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
          const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
          const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
          queryParams.week = `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
        }

        const data = (await manager.get(account, "my-deliveries/menu", queryParams)) as {
          id?: string;
          week?: number | string;
          year?: number;
          meals?: Array<{
            recipe?: Record<string, unknown>;
            selection?: { quantity?: number };
            [key: string]: unknown;
          }>;
        };

        // Each item has { recipe: {...}, selection: { quantity }, ... }
        const rawMeals = data.meals ?? [];
        let meals: Array<Record<string, unknown>> = rawMeals.map((item) => {
          const recipe = item.recipe ?? item;
          const formatted = formatMeal(recipe as Record<string, unknown>);
          return {
            ...formatted,
            selected_quantity: item.selection?.quantity ?? 0,
          };
        });

        // Apply dietary filter if specified
        if (params.filter) {
          const filterLower = params.filter.toLowerCase();
          meals = meals.filter((m) => {
            const tags = (m.tags as string[] | undefined) ?? [];
            const category = ((m.category as string) ?? "").toLowerCase();
            return (
              tags.some((t) => t.toLowerCase().includes(filterLower)) ||
              category.includes(filterLower)
            );
          });
        }

        return jsonResult({
          week: data.week,
          year: data.year,
          count: meals.length,
          meals,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
