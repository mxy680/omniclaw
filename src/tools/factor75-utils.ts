/**
 * Shared helpers for Factor75 tools.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

export function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call factor75_auth_setup to authenticate with Factor75 first.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatMeal(meal: Record<string, any>): Record<string, unknown> {
  // Nutrition can be either an object {calories, protein, ...} or an array [{type, amount}, ...]
  const nutrition = meal.nutrition ?? meal.recipe?.nutrition;
  let calories: number | null = null;
  if (nutrition) {
    if (Array.isArray(nutrition)) {
      const cal = nutrition.find(
        (n: { type?: string; name?: string }) =>
          n.name === "Calories" || n.name === "Energy" || n.type === "ENERGY_KCAL",
      );
      calories = cal?.amount ?? null;
    } else if (typeof nutrition === "object") {
      calories = nutrition.calories ?? null;
    }
  }

  // Category can be a string or an object with .name
  const rawCategory = meal.category ?? meal.recipe?.category;
  const category = typeof rawCategory === "string" ? rawCategory : rawCategory?.name ?? null;

  // Tags can be an array of objects with .name or an array of strings
  const rawTags = meal.tags ?? meal.recipe?.tags ?? [];
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t: string | { name?: string; displayLabel?: string }) =>
        typeof t === "string" ? t : (t.name ?? t.displayLabel ?? ""),
      ).filter(Boolean)
    : [];

  return {
    id: meal.id ?? meal.recipeId ?? meal.recipe?.id,
    name: meal.name ?? meal.title ?? meal.recipe?.name,
    headline: meal.headline ?? meal.subtitle ?? meal.recipe?.headline,
    description: meal.description ?? meal.recipe?.description,
    image_url: meal.image ?? meal.imagePath ?? meal.recipe?.image ?? meal.recipe?.imagePath,
    tags,
    category,
    calories,
    prep_time: meal.prepTime ?? meal.recipe?.prepTime,
    allergens: meal.allergens?.map((a: { name?: string }) => a.name) ??
      meal.recipe?.allergens?.map((a: { name?: string }) => a.name) ?? [],
    is_premium: meal.isPremium ?? meal.recipe?.isPremium ?? false,
    price_per_serving: meal.pricePerServing ?? meal.recipe?.pricePerServing,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatNutrition(nutrition: Array<Record<string, any>>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const item of nutrition) {
    // Prefer human-readable name over MongoDB type IDs
    const key = item.name ?? item.label ?? item.type;
    if (key) {
      result[key] = {
        amount: item.amount ?? item.value,
        unit: item.unit ?? item.unitOfMeasure,
      };
    }
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatDelivery(delivery: Record<string, any>): Record<string, unknown> {
  return {
    id: delivery.id ?? delivery.deliveryId,
    week: delivery.week ?? delivery.yearWeek,
    status: delivery.status ?? delivery.deliveryStatus,
    delivery_date: delivery.deliveryDate ?? delivery.shippingDate,
    tracking_url: delivery.trackingUrl ?? delivery.trackingLink,
    carrier: delivery.carrier ?? delivery.shippingCarrier,
    meals: delivery.meals?.map(formatMeal) ?? delivery.items?.map(formatMeal) ?? [],
    address: delivery.address
      ? {
          line1: delivery.address.line1 ?? delivery.address.street,
          line2: delivery.address.line2,
          city: delivery.address.city,
          state: delivery.address.state ?? delivery.address.region,
          zip: delivery.address.zip ?? delivery.address.postcode,
        }
      : null,
  };
}

export function truncateText(text: string | undefined | null, max = 500): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}
