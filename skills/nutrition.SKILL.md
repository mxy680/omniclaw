---
name: nutrition
description: Track food, exercise, biometrics, and daily notes with a local SQLite database. No external API or auth needed.
metadata: {"openclaw": {"emoji": "🥗"}}
---

# Nutrition Tracking

Log food, exercise, biometrics, and daily notes in a local SQLite database. No external API, no authentication — everything stays on your machine.

## No Setup Required

The nutrition database is automatically created at `~/.openclaw/omniclaw-nutrition.db` on first use. No credentials, no accounts, no API keys.

To use a custom location, set in plugin config:
```
openclaw config set plugins.entries.omniclaw.config.nutrition_db_path "/path/to/nutrition.db"
```

## Available Tools

- `nutrition_log_food` — Log one or more food entries with macros (calories, protein, carbs, fat, fiber, sugar, sodium)
- `nutrition_diary` — Query the food diary for a date range with daily totals and targets
- `nutrition_delete_food` — Delete a food entry by ID
- `nutrition_log_exercise` — Log an exercise session (cardio, strength, flexibility) with optional details
- `nutrition_exercises` — Query exercise entries for a date range
- `nutrition_delete_exercise` — Delete an exercise entry by ID
- `nutrition_log_biometric` — Log a biometric measurement (weight, body fat, blood pressure, heart rate, etc.)
- `nutrition_biometrics` — Query biometric measurements for a date range, optionally filtered by metric
- `nutrition_notes` — Read or write daily nutrition notes (upserts by date)
- `nutrition_set_targets` — Set daily macro/calorie targets
- `nutrition_add_pantry_item` — Add an item to the pantry inventory with optional macros per serving
- `nutrition_list_pantry` — List pantry items, optionally filtered by category
- `nutrition_update_pantry_item` — Update a pantry item's details (quantity, macros, etc.)
- `nutrition_remove_pantry_item` — Remove an item from the pantry
- `nutrition_save_meal_plan` — Save a daily meal plan with time-slotted entries (replaces existing plan for the date)
- `nutrition_get_meal_plan` — Retrieve meal plans for a date or date range
- `nutrition_delete_meal_plan` — Delete the meal plan for a specific date

## Workflow

1. Use `nutrition_set_targets` to set your daily macro goals.
2. Use `nutrition_log_food` to log meals throughout the day.
3. Use `nutrition_diary` to review your intake and compare against targets.
4. Use `nutrition_log_exercise` to track workouts.
5. Use `nutrition_log_biometric` to record weight, body fat, etc.
6. Use `nutrition_notes` to jot down daily observations.

## Examples

- "Log what I had for lunch: chicken breast 200g (330 cal, 62g protein, 0g carbs, 7g fat) and rice 1 cup (200 cal, 4g protein, 45g carbs, 0.5g fat)" → `nutrition_log_food`
- "Show my macros for this week" → `nutrition_diary` with start/end for the week
- "Track my weight: 180 lbs" → `nutrition_log_biometric` with metric "weight"
- "I ran 5 miles in 40 minutes" → `nutrition_log_exercise` with details
- "Set my daily targets to 2200 cal, 180g protein, 220g carbs, 70g fat" → `nutrition_set_targets`
- "Show my weight trend for the last month" → `nutrition_biometrics` with metric "weight"
- "Add Greek yogurt to my pantry" → `nutrition_add_pantry_item`
- "What's in my pantry?" → `nutrition_list_pantry`
- "Plan my meals for today" → Use the `meal-planning` skill for the full workflow
- "Show today's meal plan" → `nutrition_get_meal_plan`
