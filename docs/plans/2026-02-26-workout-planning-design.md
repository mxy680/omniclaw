# Workout Planning System Design

**Date:** 2026-02-26
**Status:** Approved

## Goal

Add workout planning to the OpenClaw agent — matching the meal planning pattern — so the agent can create, retrieve, and manage scheduled workout routines. The dashboard displays planned workouts and compares them against actual logged exercises.

## Data Model

Single denormalized table (same pattern as `meal_plan_entries`):

```sql
CREATE TABLE workout_plan_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  workout_name TEXT NOT NULL,       -- "Push Day", "5K Run", "Rest"
  workout_type TEXT NOT NULL,       -- "strength" | "cardio" | "rest"
  exercise_order INTEGER NOT NULL,  -- display order (0-indexed)
  exercise_name TEXT NOT NULL,      -- "Bench Press", "Treadmill", etc.
  target_sets TEXT,                 -- JSON: [{reps:8, weight:185}, ...] for strength
  duration_min REAL,                -- for cardio exercises
  distance REAL,                    -- for cardio exercises (miles)
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_workout_plan_date ON workout_plan_entries(date);
```

For rest days: single row with `exercise_name: "Rest"`, `exercise_order: 0`.

## Types

### Backend (src/nutrition/types.ts)

```typescript
export interface WorkoutPlanEntryInput {
  date: string;
  workout_name: string;
  workout_type: "strength" | "cardio" | "rest";
  exercise_order: number;
  exercise_name: string;
  target_sets?: { reps: number; weight: number }[];
  duration_min?: number;
  distance?: number;
  notes?: string;
}

export interface WorkoutPlanEntry {
  id: number;
  date: string;
  workout_name: string;
  workout_type: string;
  exercise_order: number;
  exercise_name: string;
  target_sets: { reps: number; weight: number }[] | null;
  duration_min: number | null;
  distance: number | null;
  notes: string | null;
  created_at: string;
}
```

### WebSocket (src/channel/types.ts)

```typescript
export interface WsWorkoutPlanExercise {
  id: number;
  exercise_order: number;
  exercise_name: string;
  target_sets: { reps: number; weight: number }[] | null;
  duration_min: number | null;
  distance: number | null;
  notes: string | null;
}

export interface WsWorkoutPlan {
  workout_name: string;
  workout_type: "strength" | "cardio" | "rest";
  exercises: WsWorkoutPlanExercise[];
}
```

Added to `WsFitnessDay`:
```typescript
workout_plan: WsWorkoutPlan | null;
```

### Dashboard (dashboard/src/lib/fitness-data.ts)

```typescript
export interface WorkoutPlanExercise {
  id: number;
  exerciseName: string;
  targetSets: { reps: number; weight: number }[] | null;
  durationMin: number | null;
  distance: number | null;
  notes: string | null;
}

export interface WorkoutPlan {
  workoutName: string;
  workoutType: WorkoutType;
  exercises: WorkoutPlanExercise[];
}
```

Added to `FitnessDay`:
```typescript
workoutPlan: WorkoutPlan | null;
```

## Tools (4)

### nutrition_save_workout_plan

Save one day's workout plan (replaces existing for that date).

**Parameters:**
- `date` (optional, defaults to today)
- `workout_name` — e.g. "Push Day"
- `workout_type` — "strength" | "cardio" | "rest"
- `exercises` — array of:
  - `exercise_name`
  - `target_sets?` — `[{reps, weight}, ...]` (strength)
  - `duration_min?` (cardio)
  - `distance?` (cardio)
  - `notes?`

**Behavior:** Transaction — DELETE existing for date, INSERT all new entries with auto-incrementing `exercise_order`.

**Returns:** Saved entries grouped by date.

### nutrition_save_workout_program

Bulk save a multi-day program (e.g. full week PPL split).

**Parameters:**
- `start_date`
- `days` — array of daily plans, each with:
  - `workout_name`, `workout_type`, `exercises[]`

**Behavior:** For each day: DELETE existing, INSERT new. All in one transaction. Dates auto-increment from `start_date`.

**Returns:** Summary of days saved with exercise counts.

### nutrition_get_workout_plan

Retrieve workout plans.

**Parameters:**
- `date` (optional, defaults to today)
- `end` (optional, for range query)

**Returns:** Plans grouped by date, each with workout name/type and ordered exercises.

### nutrition_delete_workout_plan

Delete a day's workout plan.

**Parameters:**
- `date` (required)

**Returns:** Count of deleted entries.

## DB Methods (NutritionDbManager)

- `saveWorkoutPlan(date, entries[])` — Transaction: DELETE for date, INSERT all
- `getWorkoutPlan(date)` — Single day, ordered by `exercise_order, id`
- `getWorkoutPlanRange(start, end)` — Range query
- `deleteWorkoutPlan(date)` — Returns count deleted

## WebSocket Integration

In `fitness-handlers.ts`, fetch workout plan for the requested date and include as `workout_plan` in the `fitness_day` response. Null if no plan exists.

## Dashboard Behavior

### Exercise Timeline (plan vs actual)

Three states:

1. **Plan only** (no logged workout): Show planned exercises in outlined/dimmed style with target sets. Header says "Planned Workout".
2. **Actual only** (no plan): Current behavior — show logged exercises normally.
3. **Both** (plan + actual): Show each planned exercise with actual results alongside. Color-coding:
   - Green: met or exceeded target
   - Amber: within ~80% of target
   - Red: significantly below target or missed entirely

### WorkoutSummaryCard (plan vs actual)

When both plan and actual exist, show comparison rows:
- Planned Volume vs Actual Volume
- Planned Reps vs Actual Reps
- Completion percentage

### WeekActivityCard

Use workout plans to show "scheduled" dots for future days with plans (already supported by the dot status).

## Files to Create/Modify

| Layer | File | Action |
|-------|------|--------|
| DB | `src/nutrition/nutrition-db-manager.ts` | Add table creation + 4 methods |
| Types | `src/nutrition/types.ts` | Add `WorkoutPlanEntryInput` + `WorkoutPlanEntry` |
| Tools | `src/tools/nutrition-save-workout-plan.ts` | Create |
| Tools | `src/tools/nutrition-save-workout-program.ts` | Create |
| Tools | `src/tools/nutrition-get-workout-plan.ts` | Create |
| Tools | `src/tools/nutrition-delete-workout-plan.ts` | Create |
| Plugin | `src/plugin.ts` | Register 4 new tools |
| Channel | `src/channel/types.ts` | Add `WsWorkoutPlan` types |
| Channel | `src/channel/fitness-handlers.ts` | Fetch + include workout_plan |
| Dashboard types | `dashboard/src/lib/fitness-data.ts` | Add `WorkoutPlan` types |
| Dashboard transform | `dashboard/src/lib/fitness-transform.ts` | Transform workout_plan |
| Dashboard hook | `dashboard/src/hooks/use-workout.ts` | Include workoutPlan |
| Dashboard component | `dashboard/src/components/workout/exercise-timeline.tsx` | Plan vs actual rendering |
| Dashboard component | `dashboard/src/components/workout/workout-summary-card.tsx` | Plan vs actual stats |
| Skill | `skills/nutrition.SKILL.md` | Add workout plan tool docs |
