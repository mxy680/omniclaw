---
name: workout
description: Log workouts, plan training programs, and track exercise history with a local SQLite database. No external API or auth needed.
metadata: {"openclaw": {"emoji": "💪"}}
---

# Workout Tracking

Log exercises, plan workouts, and track training history in a local SQLite database. No external API, no authentication — everything stays on your machine.

## No Setup Required

Uses the same database as nutrition tracking (`~/.openclaw/omniclaw-nutrition.db`), automatically created on first use.

## Available Tools

### Logging

- `nutrition_log_exercise` — Log an exercise session (cardio, strength, flexibility) with optional details (sets, reps, weight, duration, distance, heart rate, calories burned)
- `nutrition_exercises` — Query exercise entries for a date range
- `nutrition_delete_exercise` — Delete an exercise entry by ID

### Planning

- `nutrition_save_workout_plan` — Save a daily workout plan with exercises and target sets/reps/weight (replaces existing plan for the date)
- `nutrition_save_workout_program` — Bulk-save a multi-day workout program (e.g. a week-long PPL split)
- `nutrition_get_workout_plan` — Retrieve workout plans for a date or date range
- `nutrition_delete_workout_plan` — Delete the workout plan for a specific date

### Biometrics

- `nutrition_log_biometric` — Log a biometric measurement (weight, body fat, blood pressure, heart rate, etc.)
- `nutrition_biometrics` — Query biometric measurements for a date range, optionally filtered by metric

## Workflow

1. Use `nutrition_save_workout_program` to plan a training program (e.g. a week of push/pull/legs).
2. Use `nutrition_get_workout_plan` to check what's planned for today.
3. Use `nutrition_log_exercise` to log the actual workout after completing it.
4. Use `nutrition_log_biometric` to track weight, body fat, etc.
5. Use `nutrition_exercises` to review training history.

## Examples

- "I did bench press 3x8 at 185, incline DB 3x10 at 70, cable flies 3x12 at 40" → `nutrition_log_exercise`
- "I ran 5 miles in 40 minutes" → `nutrition_log_exercise` with cardio details
- "Plan my workouts for next week: push/pull/legs split" → `nutrition_save_workout_program`
- "What's my workout plan for today?" → `nutrition_get_workout_plan`
- "Save today's workout: Push Day — bench press 4x8, OHP 3x10, tricep pushdowns 3x12" → `nutrition_save_workout_plan`
- "Show my workouts this week" → `nutrition_exercises` with date range
- "Track my weight: 180 lbs" → `nutrition_log_biometric` with metric "weight"
- "Show my weight trend for the last month" → `nutrition_biometrics` with metric "weight"
- "Delete yesterday's workout plan" → `nutrition_delete_workout_plan`
