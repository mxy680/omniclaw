import { Type } from "@sinclair/typebox";
import type { Factor75ClientManager } from "../auth/factor75-client-manager.js";
import { jsonResult, AUTH_REQUIRED, formatMeal, formatNutrition } from "./factor75-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFactor75MealDetailsTool(manager: Factor75ClientManager): any {
  return {
    name: "factor75_meal_details",
    label: "Factor75 Meal Details",
    description:
      "Get full details for a specific Factor75 meal — nutrition facts, ingredients list, allergens, preparation instructions, and images.",
    parameters: Type.Object({
      meal_id: Type.String({
        description: "The meal/recipe ID to get details for.",
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
      params: { meal_id: string; account?: string },
    ) {
      const account = params.account ?? "default";
      if (!manager.hasCredentials(account)) {
        return jsonResult(AUTH_REQUIRED);
      }

      try {
        // GET /gw/api/recipes/{id}
        const recipe = (await manager.get(
          account,
          `api/recipes/${params.meal_id}`,
        )) as Record<string, unknown>;

        if (!recipe || Object.keys(recipe).length === 0) {
          return jsonResult({ error: "Meal not found", meal_id: params.meal_id });
        }

        const formatted = formatMeal(recipe);

        const nutrition = recipe.nutrition as Array<Record<string, unknown>> | undefined;
        const ingredients = recipe.ingredients as
          | Array<{ id?: string; name?: string; imagePath?: string; shipped?: boolean }>
          | undefined;
        const utensils = recipe.utensils as Array<{ name?: string }> | undefined;

        return jsonResult({
          ...formatted,
          nutrition_details: nutrition ? formatNutrition(nutrition) : null,
          ingredients:
            ingredients?.map((i) => ({
              name: i.name,
              shipped: i.shipped ?? true,
            })) ?? [],
          utensils: utensils?.map((u) => u.name) ?? [],
          serving_size: recipe.servingSize ?? recipe.serving_size,
          card_link: recipe.cardLink ?? recipe.card_link,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
