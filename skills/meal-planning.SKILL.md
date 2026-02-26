---
name: meal-planning
description: Plan daily meals combining Factor75 deliveries with pantry items to hit nutrition targets. Manage pantry inventory and generate scheduled meal plans.
metadata: {"openclaw": {"emoji": "📋"}}
---

# Meal Planning

Create daily meal plans that combine Factor75 delivered meals with pantry items, targeting your nutrition goals. Manage a pantry inventory and generate time-slotted meal schedules.

## Workflow

When the user asks to plan meals ("plan my meals", "what should I eat today?", "plan the week"):

1. **Check targets** — Use `nutrition_set_targets` to verify active targets exist, or ask the user to set them.
2. **Check Factor75 deliveries** — Use `factor75_deliveries` and `factor75_delivery_details` to see what delivered meals are in the fridge (look at the most recent delivered order).
3. **Check pantry** — Use `nutrition_list_pantry` to see what items are available at home.
4. **Compose the plan** — Allocate meals to time slots:
   - **Factor75 meals** → Lunch and/or Dinner (they are full, macro-balanced meals)
   - **Pantry items** → Breakfast, snacks, and any remaining slots
   - **Target macro totals** for the day should match the user's nutrition targets
5. **Save the plan** — Use `nutrition_save_meal_plan` with the composed entries.
6. **Confirm with the user** — Show the schedule with times, items, source, and how daily totals compare to targets.

### Default Time Slots

| Slot | Time | Typical Source |
|------|------|----------------|
| Breakfast | 08:00 | Pantry |
| Morning Snack | 10:30 | Pantry |
| Lunch | 12:30 | Factor75 |
| Afternoon Snack | 15:00 | Pantry |
| Dinner | 18:30 | Factor75 |
| Evening Snack | 20:30 | Pantry |

Adjust times based on user preferences. Not every slot needs to be filled.

## Available Tools

### Pantry Inventory

- `nutrition_add_pantry_item` — Add an item to the pantry (name, category, quantity, unit, macros per serving)
- `nutrition_list_pantry` — List pantry items, optionally filtered by category (snack, protein, dairy, grain, fruit, vegetable, condiment, other)
- `nutrition_update_pantry_item` — Update an item's details (quantity, macros, etc.)
- `nutrition_remove_pantry_item` — Remove an item from the pantry

### Meal Plans

- `nutrition_save_meal_plan` — Save a daily meal plan (replaces existing plan for that date). Set `deduct_pantry: true` to automatically reduce pantry quantities.
- `nutrition_get_meal_plan` — Retrieve the meal plan for a date or date range
- `nutrition_delete_meal_plan` — Delete the meal plan for a date

## Planning Multi-Day

When the user asks to "plan the week":

1. Check Factor75 deliveries to count available meals
2. Spread Factor75 meals across the days (typically 2 per day for lunch + dinner)
3. Fill breakfast and snacks from pantry for each day
4. Save each day individually with `nutrition_save_meal_plan`
5. Present a summary table showing each day's totals vs targets

## Examples

- "Plan my meals for today" → Full workflow: check targets, Factor75, pantry, compose, save
- "What should I eat?" → Same as above, present the plan conversationally
- "Add Greek yogurt to my pantry — 100 cal, 17g protein per cup" → `nutrition_add_pantry_item`
- "What's in my pantry?" → `nutrition_list_pantry`
- "Show today's meal plan" → `nutrition_get_meal_plan`
- "I ate the last protein bar, remove it" → `nutrition_remove_pantry_item` or `nutrition_update_pantry_item` with quantity 0
- "Plan Monday through Friday" → Multi-day workflow
- "Delete tomorrow's meal plan, I'm eating out" → `nutrition_delete_meal_plan`
