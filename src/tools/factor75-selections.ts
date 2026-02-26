import { Type } from "@sinclair/typebox";
import type { Factor75ClientManager } from "../auth/factor75-client-manager.js";
import { jsonResult, AUTH_REQUIRED, formatMeal } from "./factor75-utils.js";

/**
 * Helper: compute ISO week string for the next upcoming week.
 */
function getNextISOWeek(): string {
  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + (7 - now.getDay()) % 7 + 1);
  const tmp = new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Helper: fetch the menu for a given week and return the full response.
 * Selections are embedded in the menu (meals with selection.quantity > 0).
 */
async function fetchMenuForWeek(
  manager: Factor75ClientManager,
  account: string,
  week: string,
) {
  const subParams = await manager.getSubscriptionParams(account);
  const queryParams: Record<string, string> = {
    subscription: String(subParams.subscriptionId),
    customerPlanId: subParams.customerPlanId,
    "product-sku": subParams.productSku,
    "delivery-option": subParams.deliveryOption,
    postcode: subParams.postcode,
    servings: "1",
    "include-future-feedback": "true",
    week,
  };
  if (subParams.preference) {
    queryParams.preference = subParams.preference;
  }

  return (await manager.get(account, "my-deliveries/menu", queryParams)) as {
    id?: string;
    week?: string;
    mealsReady?: boolean;
    mealsPreselected?: boolean;
    modularity?: Array<Record<string, unknown>>;
    meals?: Array<{
      recipe?: Record<string, unknown>;
      selection?: { quantity?: number };
      index?: number;
      [key: string]: unknown;
    }>;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75GetSelectionsTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_get_selections",
    label: "Factor75 Selections",
    description:
      "Get the user's current meal selections for a given week. Shows which meals are selected, how many slots remain, and total quantity.",
    parameters: Type.Object({
      week: Type.Optional(
        Type.String({
          description:
            "Week identifier (e.g. '2026-W09'). Defaults to the next upcoming delivery week.",
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
      params: { week?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const week = params.week ?? getNextISOWeek();
        const menu = await fetchMenuForWeek(manager, account, week);

        const rawMeals = menu.meals ?? [];
        const selectedMeals = rawMeals
          .filter((item) => (item.selection?.quantity ?? 0) > 0)
          .map((item) => {
            const recipe = item.recipe ?? item;
            const formatted = formatMeal(recipe as Record<string, unknown>);
            return {
              ...formatted,
              quantity: item.selection?.quantity ?? 0,
            };
          });

        const totalQuantity = selectedMeals.reduce(
          (sum, m) => sum + ((m.quantity as number) ?? 0),
          0,
        );
        // modularity length = number of meal slots per week
        const mealsPerWeek = menu.modularity?.length ?? 0;

        return jsonResult({
          week: menu.week ?? week,
          meals_per_week: mealsPerWeek,
          selected_count: selectedMeals.length,
          total_quantity: totalQuantity,
          meals_ready: menu.mealsReady ?? false,
          meals_preselected: menu.mealsPreselected ?? false,
          selected_meals: selectedMeals,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75SelectMealTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_select_meal",
    label: "Factor75 Select Meal",
    description:
      "Add a meal to the user's selections for a given week. Specify the meal ID from the menu.",
    parameters: Type.Object({
      meal_id: Type.String({
        description: "The meal/recipe ID to add to selections.",
      }),
      week: Type.Optional(
        Type.String({
          description:
            "Week identifier (e.g. '2026-W09'). Defaults to the next upcoming delivery week.",
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
      params: { meal_id: string; week?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const subParams = await manager.getSubscriptionParams(account);
        const week = params.week ?? getNextISOWeek();

        const body: Record<string, unknown> = {
          recipeId: params.meal_id,
          subscriptionId: subParams.subscriptionId,
          week,
        };

        // POST /gw/my-deliveries/select
        const data = (await manager.post(
          account,
          "my-deliveries/select",
          body,
        )) as Record<string, unknown>;

        // Re-fetch menu to get updated selections
        const menu = await fetchMenuForWeek(manager, account, week);
        const selectedMeals = (menu.meals ?? [])
          .filter((item) => (item.selection?.quantity ?? 0) > 0)
          .map((item) => {
            const recipe = item.recipe ?? item;
            const formatted = formatMeal(recipe as Record<string, unknown>);
            return { ...formatted, quantity: item.selection?.quantity ?? 0 };
          });

        const totalQuantity = selectedMeals.reduce(
          (sum, m) => sum + ((m.quantity as number) ?? 0),
          0,
        );

        return jsonResult({
          status: data.error ? "error" : "meal_added",
          meal_id: params.meal_id,
          week,
          selected_count: selectedMeals.length,
          total_quantity: totalQuantity,
          selected_meals: selectedMeals,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75RemoveMealTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_remove_meal",
    label: "Factor75 Remove Meal",
    description:
      "Remove a meal from the user's selections for a given week.",
    parameters: Type.Object({
      meal_id: Type.String({
        description: "The meal/recipe ID to remove from selections.",
      }),
      week: Type.Optional(
        Type.String({
          description:
            "Week identifier (e.g. '2026-W09'). Defaults to the next upcoming delivery week.",
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
      params: { meal_id: string; week?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        const subParams = await manager.getSubscriptionParams(account);
        const week = params.week ?? getNextISOWeek();
        const session = manager.getCredentials(account);
        if (!session) throw new Error("No credentials for account: " + account);

        // DELETE /gw/my-deliveries/select with query params
        const qs = new URLSearchParams({
          recipeId: params.meal_id,
          subscription: String(subParams.subscriptionId),
          week,
          country: session.country,
          locale: "en-US",
        });
        const resp = await fetch(
          `https://www.factor75.com/gw/my-deliveries/select?${qs}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              Origin: "https://www.factor75.com",
              Referer: "https://www.factor75.com/",
            },
          },
        );

        if (resp.status === 401 || resp.status === 403) {
          throw new Error("Factor75 session expired. Call factor75_auth_setup to re-authenticate.");
        }
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`Factor75 API error: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`);
        }

        // Re-fetch menu to get updated selections
        const menu = await fetchMenuForWeek(manager, account, week);
        const selectedMeals = (menu.meals ?? [])
          .filter((item) => (item.selection?.quantity ?? 0) > 0)
          .map((item) => {
            const recipe = item.recipe ?? item;
            const formatted = formatMeal(recipe as Record<string, unknown>);
            return { ...formatted, quantity: item.selection?.quantity ?? 0 };
          });

        const totalQuantity = selectedMeals.reduce(
          (sum, m) => sum + ((m.quantity as number) ?? 0),
          0,
        );

        return jsonResult({
          status: "meal_removed",
          meal_id: params.meal_id,
          week,
          selected_count: selectedMeals.length,
          total_quantity: totalQuantity,
          selected_meals: selectedMeals,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
