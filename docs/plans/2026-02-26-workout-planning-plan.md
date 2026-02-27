# Workout Planning System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add workout planning tools, DB persistence, WS delivery, and dashboard plan-vs-actual display — mirroring the meal planning system.

**Architecture:** New `workout_plan_entries` SQLite table, 4 agent tools (save/program/get/delete), WS `fitness_day` response extended with `workout_plan`, dashboard transforms and components updated for plan-vs-actual rendering.

**Tech Stack:** TypeScript, better-sqlite3, @sinclair/typebox, Next.js 15, React 19, Tailwind v4, lucide-react

---

## Task 1: Add backend types

**Files:**
- Modify: `src/nutrition/types.ts` (append after line 135)

**Step 1: Add workout plan types**

Append at end of `src/nutrition/types.ts`:

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

**Step 2: Verify**

Run: `pnpm build`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add src/nutrition/types.ts
git commit -m "feat: add WorkoutPlanEntryInput and WorkoutPlanEntry types"
```

---

## Task 2: Add DB table and methods

**Files:**
- Modify: `src/nutrition/nutrition-db-manager.ts`

**Step 1: Add table to `migrate()` method**

Inside the `this.db.exec(...)` block in `migrate()`, after the `meal_plan_entries` table (after line 129), add:

```sql
CREATE TABLE IF NOT EXISTS workout_plan_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  workout_name TEXT NOT NULL,
  workout_type TEXT NOT NULL,
  exercise_order INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  target_sets TEXT,
  duration_min REAL,
  distance REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workout_plan_date ON workout_plan_entries(date);
```

**Step 2: Add import for `WorkoutPlanEntryInput` and `WorkoutPlanEntry`**

In the import block at the top (line 4-18), add `WorkoutPlanEntryInput` and `WorkoutPlanEntry` to the import from `"./types.js"`.

**Step 3: Add 4 DB methods**

Add after the `deleteMealPlan` method (after line 482), before `close()`:

```typescript
// ── Workout Plan ─────────────────────────────────────────

saveWorkoutPlan(date: string, entries: WorkoutPlanEntryInput[]): WorkoutPlanEntry[] {
  const results: WorkoutPlanEntry[] = [];
  const txn = this.db.transaction(() => {
    this.db.prepare(`DELETE FROM workout_plan_entries WHERE date = ?`).run(date);

    const insert = this.db.prepare(
      `INSERT INTO workout_plan_entries (date, workout_name, workout_type, exercise_order, exercise_name, target_sets, duration_min, distance, notes)
       VALUES (@date, @workout_name, @workout_type, @exercise_order, @exercise_name, @target_sets, @duration_min, @distance, @notes)`,
    );

    for (const e of entries) {
      const info = insert.run({
        date,
        workout_name: e.workout_name,
        workout_type: e.workout_type,
        exercise_order: e.exercise_order,
        exercise_name: e.exercise_name,
        target_sets: e.target_sets ? JSON.stringify(e.target_sets) : null,
        duration_min: e.duration_min ?? null,
        distance: e.distance ?? null,
        notes: e.notes ?? null,
      });
      results.push({
        id: Number(info.lastInsertRowid),
        date,
        workout_name: e.workout_name,
        workout_type: e.workout_type,
        exercise_order: e.exercise_order,
        exercise_name: e.exercise_name,
        target_sets: e.target_sets ?? null,
        duration_min: e.duration_min ?? null,
        distance: e.distance ?? null,
        notes: e.notes ?? null,
        created_at: new Date().toISOString(),
      });
    }
  });
  txn();
  return results;
}

getWorkoutPlan(date: string): WorkoutPlanEntry[] {
  const rows = this.db
    .prepare(`SELECT * FROM workout_plan_entries WHERE date = ? ORDER BY exercise_order, id`)
    .all(date) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    ...row,
    target_sets: row.target_sets ? JSON.parse(row.target_sets as string) : null,
  })) as WorkoutPlanEntry[];
}

getWorkoutPlanRange(start: string, end: string): WorkoutPlanEntry[] {
  const rows = this.db
    .prepare(
      `SELECT * FROM workout_plan_entries WHERE date >= ? AND date <= ? ORDER BY date, exercise_order, id`,
    )
    .all(start, end) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    ...row,
    target_sets: row.target_sets ? JSON.parse(row.target_sets as string) : null,
  })) as WorkoutPlanEntry[];
}

deleteWorkoutPlan(date: string): number {
  const info = this.db.prepare(`DELETE FROM workout_plan_entries WHERE date = ?`).run(date);
  return info.changes;
}
```

**Step 4: Verify**

Run: `pnpm build`
Expected: Clean compilation

**Step 5: Commit**

```bash
git add src/nutrition/nutrition-db-manager.ts
git commit -m "feat: add workout_plan_entries table and CRUD methods"
```

---

## Task 3: Create save workout plan tool

**Files:**
- Create: `src/tools/nutrition-save-workout-plan.ts`

**Step 1: Create the tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionSaveWorkoutPlanTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_save_workout_plan",
    label: "Save Workout Plan",
    description:
      "Save a daily workout plan with exercises and target sets/reps/weight. Replaces any existing plan for the date.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({ description: "Date in YYYY-MM-DD format. Defaults to today." }),
      ),
      workout_name: Type.String({ description: 'Workout name, e.g. "Push Day", "5K Run", "Rest"' }),
      workout_type: Type.Union(
        [Type.Literal("strength"), Type.Literal("cardio"), Type.Literal("rest")],
        { description: "Workout type" },
      ),
      exercises: Type.Array(
        Type.Object({
          exercise_name: Type.String({ description: "Exercise name" }),
          target_sets: Type.Optional(
            Type.Array(
              Type.Object({
                reps: Type.Number({ description: "Target reps" }),
                weight: Type.Number({ description: "Target weight in lb" }),
              }),
              { description: "Target sets for strength exercises" },
            ),
          ),
          duration_min: Type.Optional(Type.Number({ description: "Duration in minutes (cardio)" })),
          distance: Type.Optional(Type.Number({ description: "Distance in miles (cardio)" })),
          notes: Type.Optional(Type.String({ description: "Notes for this exercise" })),
        }),
        { description: "Array of exercises for the workout" },
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        date?: string;
        workout_name: string;
        workout_type: "strength" | "cardio" | "rest";
        exercises: Array<{
          exercise_name: string;
          target_sets?: { reps: number; weight: number }[];
          duration_min?: number;
          distance?: number;
          notes?: string;
        }>;
      },
    ) {
      try {
        const date = params.date ?? todayStr();
        const entries = db.saveWorkoutPlan(
          date,
          params.exercises.map((e, i) => ({
            date,
            workout_name: params.workout_name,
            workout_type: params.workout_type,
            exercise_order: i,
            exercise_name: e.exercise_name,
            target_sets: e.target_sets,
            duration_min: e.duration_min,
            distance: e.distance,
            notes: e.notes,
          })),
        );

        return jsonResult({
          date,
          workout_name: params.workout_name,
          workout_type: params.workout_type,
          exercises: entries,
          exercise_count: entries.length,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify**

Run: `pnpm build`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add src/tools/nutrition-save-workout-plan.ts
git commit -m "feat: add nutrition_save_workout_plan tool"
```

---

## Task 4: Create save workout program tool

**Files:**
- Create: `src/tools/nutrition-save-workout-program.ts`

**Step 1: Create the tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionSaveWorkoutProgramTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_save_workout_program",
    label: "Save Workout Program",
    description:
      "Bulk-save a multi-day workout program. Dates auto-increment from start_date. Replaces existing plans for each date.",
    parameters: Type.Object({
      start_date: Type.String({ description: "Start date in YYYY-MM-DD format" }),
      days: Type.Array(
        Type.Object({
          workout_name: Type.String({ description: "Workout name for this day" }),
          workout_type: Type.Union(
            [Type.Literal("strength"), Type.Literal("cardio"), Type.Literal("rest")],
            { description: "Workout type" },
          ),
          exercises: Type.Array(
            Type.Object({
              exercise_name: Type.String({ description: "Exercise name" }),
              target_sets: Type.Optional(
                Type.Array(
                  Type.Object({
                    reps: Type.Number({ description: "Target reps" }),
                    weight: Type.Number({ description: "Target weight in lb" }),
                  }),
                ),
              ),
              duration_min: Type.Optional(Type.Number({ description: "Duration in minutes" })),
              distance: Type.Optional(Type.Number({ description: "Distance in miles" })),
              notes: Type.Optional(Type.String({ description: "Notes" })),
            }),
            { description: "Exercises for this day" },
          ),
        }),
        { description: "Array of daily plans, one per day starting from start_date" },
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        start_date: string;
        days: Array<{
          workout_name: string;
          workout_type: "strength" | "cardio" | "rest";
          exercises: Array<{
            exercise_name: string;
            target_sets?: { reps: number; weight: number }[];
            duration_min?: number;
            distance?: number;
            notes?: string;
          }>;
        }>;
      },
    ) {
      try {
        const summary: Array<{ date: string; workout_name: string; exercise_count: number }> = [];

        for (let i = 0; i < params.days.length; i++) {
          const d = new Date(params.start_date + "T00:00:00");
          d.setDate(d.getDate() + i);
          const date = d.toISOString().slice(0, 10);
          const day = params.days[i];

          db.saveWorkoutPlan(
            date,
            day.exercises.map((e, j) => ({
              date,
              workout_name: day.workout_name,
              workout_type: day.workout_type,
              exercise_order: j,
              exercise_name: e.exercise_name,
              target_sets: e.target_sets,
              duration_min: e.duration_min,
              distance: e.distance,
              notes: e.notes,
            })),
          );

          summary.push({
            date,
            workout_name: day.workout_name,
            exercise_count: day.exercises.length,
          });
        }

        return jsonResult({
          days_saved: summary.length,
          start_date: params.start_date,
          summary,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Verify**

Run: `pnpm build`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add src/tools/nutrition-save-workout-program.ts
git commit -m "feat: add nutrition_save_workout_program tool for multi-day plans"
```

---

## Task 5: Create get and delete workout plan tools

**Files:**
- Create: `src/tools/nutrition-get-workout-plan.ts`
- Create: `src/tools/nutrition-delete-workout-plan.ts`

**Step 1: Create get tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import type { WorkoutPlanEntry } from "../nutrition/types.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionGetWorkoutPlanTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_get_workout_plan",
    label: "Get Workout Plan",
    description:
      "Retrieve saved workout plans. Returns a single day by default, or a date range if 'end' is provided.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({ description: "Start date in YYYY-MM-DD format. Defaults to today." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date for range query. If omitted, returns single day." }),
      ),
    }),
    async execute(_toolCallId: string, params: { date?: string; end?: string }) {
      try {
        const date = params.date ?? todayStr();
        const entries = params.end
          ? db.getWorkoutPlanRange(date, params.end)
          : db.getWorkoutPlan(date);

        // Group by date
        const byDate = new Map<string, WorkoutPlanEntry[]>();
        for (const e of entries) {
          const arr = byDate.get(e.date) ?? [];
          arr.push(e);
          byDate.set(e.date, arr);
        }

        const plans = Array.from(byDate.entries()).map(([d, dayEntries]) => ({
          date: d,
          workout_name: dayEntries[0].workout_name,
          workout_type: dayEntries[0].workout_type,
          exercises: dayEntries.map((e) => ({
            exercise_name: e.exercise_name,
            target_sets: e.target_sets,
            duration_min: e.duration_min,
            distance: e.distance,
            notes: e.notes,
          })),
        }));

        return jsonResult({ plans });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 2: Create delete tool**

```typescript
import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionDeleteWorkoutPlanTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_delete_workout_plan",
    label: "Delete Workout Plan",
    description: "Delete the workout plan for a specific date.",
    parameters: Type.Object({
      date: Type.String({ description: "Date in YYYY-MM-DD format" }),
    }),
    async execute(_toolCallId: string, params: { date: string }) {
      try {
        const deleted_count = db.deleteWorkoutPlan(params.date);
        return jsonResult({
          deleted_count,
          message: deleted_count > 0
            ? `Deleted ${deleted_count} workout plan entries for ${params.date}`
            : `No workout plan found for ${params.date}`,
        });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
```

**Step 3: Verify**

Run: `pnpm build`
Expected: Clean compilation

**Step 4: Commit**

```bash
git add src/tools/nutrition-get-workout-plan.ts src/tools/nutrition-delete-workout-plan.ts
git commit -m "feat: add get and delete workout plan tools"
```

---

## Task 6: Register tools in plugin.ts

**Files:**
- Modify: `src/plugin.ts`

**Step 1: Add imports**

After the meal plan tool imports (line 190), add:

```typescript
import { createNutritionSaveWorkoutPlanTool } from "./tools/nutrition-save-workout-plan.js";
import { createNutritionSaveWorkoutProgramTool } from "./tools/nutrition-save-workout-program.js";
import { createNutritionGetWorkoutPlanTool } from "./tools/nutrition-get-workout-plan.js";
import { createNutritionDeleteWorkoutPlanTool } from "./tools/nutrition-delete-workout-plan.js";
```

**Step 2: Register tools**

After the meal plan tool registrations (after line 470: `reg(createNutritionDeleteMealPlanTool(nutritionDb));`), add:

```typescript
  reg(createNutritionSaveWorkoutPlanTool(nutritionDb));
  reg(createNutritionSaveWorkoutProgramTool(nutritionDb));
  reg(createNutritionGetWorkoutPlanTool(nutritionDb));
  reg(createNutritionDeleteWorkoutPlanTool(nutritionDb));
```

**Step 3: Verify**

Run: `pnpm build`
Expected: Clean compilation

**Step 4: Commit**

```bash
git add src/plugin.ts
git commit -m "feat: register 4 workout plan tools in plugin"
```

---

## Task 7: Add WS types and handler

**Files:**
- Modify: `src/channel/types.ts`
- Modify: `src/channel/fitness-handlers.ts`

**Step 1: Add WS types**

In `src/channel/types.ts`, after the `WsMealPlanEntry` type (after line 147), add:

```typescript
export type WsWorkoutPlanExercise = {
  id: number;
  exercise_order: number;
  exercise_name: string;
  target_sets: { reps: number; weight: number }[] | null;
  duration_min: number | null;
  distance: number | null;
  notes: string | null;
};

export type WsWorkoutPlan = {
  workout_name: string;
  workout_type: string;
  exercises: WsWorkoutPlanExercise[];
};
```

In the `WsFitnessDay` type (line 72), add a new field after `pantry_items`:

```typescript
  workout_plan: WsWorkoutPlan | null;
```

**Step 2: Update fitness handler**

In `src/channel/fitness-handlers.ts`, after the pantry items fetch (after line 34), add:

```typescript
  // Workout plan for the requested date
  const workoutPlanEntries = db.getWorkoutPlan(date);
```

In the `data` object assembly (inside the `WsFitnessDay` literal, after `pantry_items`), add:

```typescript
    workout_plan: workoutPlanEntries.length > 0
      ? {
          workout_name: workoutPlanEntries[0].workout_name,
          workout_type: workoutPlanEntries[0].workout_type,
          exercises: workoutPlanEntries.map((e) => ({
            id: e.id,
            exercise_order: e.exercise_order,
            exercise_name: e.exercise_name,
            target_sets: e.target_sets ?? null,
            duration_min: e.duration_min ?? null,
            distance: e.distance ?? null,
            notes: e.notes ?? null,
          })),
        }
      : null,
```

Also add `week_workout_plans` to the `fitness_day` response: fetch the workout plan range for the week (Mon–Sun) and include dates that have plans. Add after the `week_exercises` computation (after line 52):

```typescript
  // Week workout plans (dates with plans in the current week)
  const weekPlans = db.getWorkoutPlanRange(monday, sunday);
  const planDates = new Set<string>();
  for (const p of weekPlans) {
    planDates.add(p.date);
  }
  const week_workout_plans: Array<{ date: string }> = Array.from(planDates).map((d) => ({ date: d }));
```

Add `week_workout_plans` to the `WsFitnessDay` type in `types.ts`:

```typescript
  week_workout_plans: Array<{ date: string }>;
```

And include `week_workout_plans` in the response data object.

**Step 3: Verify**

Run: `pnpm build`
Expected: Clean compilation

**Step 4: Commit**

```bash
git add src/channel/types.ts src/channel/fitness-handlers.ts
git commit -m "feat: serve workout_plan in fitness_day WS response"
```

---

## Task 8: Update dashboard WS types and transform

**Files:**
- Modify: `dashboard/src/lib/websocket.ts`
- Modify: `dashboard/src/lib/fitness-data.ts`
- Modify: `dashboard/src/lib/fitness-transform.ts`

**Step 1: Add WS types to dashboard**

In `dashboard/src/lib/websocket.ts`, after `WsMealPlanEntry` (after line 118), add:

```typescript
export type WsWorkoutPlanExercise = {
  id: number;
  exercise_order: number;
  exercise_name: string;
  target_sets: { reps: number; weight: number }[] | null;
  duration_min: number | null;
  distance: number | null;
  notes: string | null;
};

export type WsWorkoutPlan = {
  workout_name: string;
  workout_type: string;
  exercises: WsWorkoutPlanExercise[];
};
```

In the `WsFitnessDay` type, add after `pantry_items`:

```typescript
  workout_plan: WsWorkoutPlan | null;
  week_workout_plans: Array<{ date: string }>;
```

**Step 2: Add client-side types**

In `dashboard/src/lib/fitness-data.ts`, after the `WorkoutSession` interface (after line 60), add:

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

In the `FitnessDay` interface, add after `pantryItems`:

```typescript
  workoutPlan: WorkoutPlan | null;
```

**Step 3: Add transform function**

In `dashboard/src/lib/fitness-transform.ts`:

1. Import the new types: add `WorkoutPlan` to the import from `"./fitness-data"` and `WsWorkoutPlan` (if used) — actually we use the `WsFitnessDay` which already contains it.

2. In `transformFitnessDay`, add `workoutPlan: buildWorkoutPlan(ws),` to the returned object.

3. Add the transform function after `buildPantryItems`:

```typescript
// ── Workout Plan ──────────────────────────────────────────────────

function buildWorkoutPlan(ws: WsFitnessDay): WorkoutPlan | null {
  if (!ws.workout_plan) return null;

  return {
    workoutName: ws.workout_plan.workout_name,
    workoutType: ws.workout_plan.workout_type as WorkoutType,
    exercises: ws.workout_plan.exercises.map((e) => ({
      id: e.id,
      exerciseName: e.exercise_name,
      targetSets: e.target_sets,
      durationMin: e.duration_min,
      distance: e.distance,
      notes: e.notes,
    })),
  };
}
```

4. Update `buildWeekOverview` to use `week_workout_plans` for "scheduled" status. Replace the status logic (lines 229-236) so that future days with workout plans show "scheduled" instead of just defaulting:

```typescript
const planDates = new Set((ws as any).week_workout_plans?.map((p: { date: string }) => p.date) ?? []);
```

Then in the status determination:
```typescript
    let status: "completed" | "scheduled" | "rest";
    if (hasExercise) {
      status = "completed";
    } else if (!isPast && planDates.has(dateStr)) {
      status = "scheduled";
    } else if (isPast) {
      status = "rest";
    } else {
      status = "rest";
    }
```

**Step 4: Verify**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Clean compilation

**Step 5: Commit**

```bash
git add dashboard/src/lib/websocket.ts dashboard/src/lib/fitness-data.ts dashboard/src/lib/fitness-transform.ts
git commit -m "feat: transform workout_plan in dashboard fitness pipeline"
```

---

## Task 9: Update useWorkout hook

**Files:**
- Modify: `dashboard/src/hooks/use-workout.ts`

**Step 1: Add workoutPlan to hook**

Update the import to include `WorkoutPlan`:

```typescript
import type { WorkoutSession, WeekDay, WorkoutPlan } from "@/lib/fitness-data";
```

Update the `WorkoutPageData` interface:

```typescript
export interface WorkoutPageData {
  workout: WorkoutSession;
  workoutPlan: WorkoutPlan | null;
  weekOverview: WeekDay[];
  date: Date;
}
```

Update the mapping:

```typescript
  const workout: WorkoutPageData | null = data
    ? {
        workout: data.workout,
        workoutPlan: data.workoutPlan,
        weekOverview: data.weekOverview,
        date: data.date,
      }
    : null;
```

**Step 2: Verify**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add dashboard/src/hooks/use-workout.ts
git commit -m "feat: include workoutPlan in useWorkout hook"
```

---

## Task 10: Update ExerciseTimeline for plan vs actual

**Files:**
- Modify: `dashboard/src/components/workout/exercise-timeline.tsx`

**Step 1: Update component**

Add `WorkoutPlan` to props. The component now handles 3 states:
1. Plan only (no actual workout) — show planned exercises in dimmed style
2. Actual only (no plan) — current behavior
3. Both — show each planned exercise with actual results alongside

Update the props interface:

```typescript
import type { WorkoutSession, Exercise, WorkoutPlan, WorkoutPlanExercise } from "@/lib/fitness-data";

interface ExerciseTimelineProps {
  workout: WorkoutSession;
  workoutPlan: WorkoutPlan | null;
  color: string;
}
```

Update the component signature to accept `workoutPlan`.

For the strength rendering section, when `workoutPlan` exists and has exercises:
- Match each planned exercise to actual by `exerciseName` vs `name` (case-insensitive)
- Show planned target alongside actual, with color-coded comparison:
  - Green (`text-emerald-500`): actual volume >= planned volume
  - Amber (`text-amber-500`): actual volume >= 80% of planned
  - Red (`text-red-400`): actual volume < 80% of planned
  - If no actual match, show planned in muted/outlined style

For the plan-only state (workout is rest/empty but plan exists):
- Show the planned exercises in a dimmed timeline style with dashed border
- Header: "Planned Workout" with the plan's workout name

Reference the existing code patterns: timeline dot, connector line, hover states.

**Step 2: Verify**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add dashboard/src/components/workout/exercise-timeline.tsx
git commit -m "feat: add plan vs actual rendering to ExerciseTimeline"
```

---

## Task 11: Update WorkoutSummaryCard for plan vs actual

**Files:**
- Modify: `dashboard/src/components/workout/workout-summary-card.tsx`

**Step 1: Update component**

Add `workoutPlan` to props:

```typescript
import type { WorkoutSession, WorkoutPlan } from "@/lib/fitness-data";

interface WorkoutSummaryCardProps {
  workout: WorkoutSession;
  workoutPlan: WorkoutPlan | null;
  color: string;
}
```

When both plan and actual exist for strength:
- Add "Planned Volume" row alongside actual
- Add "Completion" percentage row: `Math.round((actualVolume / plannedVolume) * 100)`
- Color the completion value: green >= 100%, amber >= 80%, red < 80%

When plan only exists:
- Show planned stats: total planned volume, total planned reps, from `workoutPlan.exercises`

Compute planned volume: `Σ(exercise.targetSets.reduce((s, set) => s + set.weight * set.reps, 0))` across all exercises.

**Step 2: Verify**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add dashboard/src/components/workout/workout-summary-card.tsx
git commit -m "feat: add plan vs actual stats to WorkoutSummaryCard"
```

---

## Task 12: Update fitness page to pass workoutPlan

**Files:**
- Modify: `dashboard/src/app/(dashboard)/health/fitness/page.tsx`

**Step 1: Pass workoutPlan to components**

Update `ExerciseTimeline` and `WorkoutSummaryCard` calls to include `workoutPlan`:

```tsx
<ExerciseTimeline workout={workout.workout} workoutPlan={workout.workoutPlan} color={COLOR} />
```

```tsx
<WorkoutSummaryCard workout={workout.workout} workoutPlan={workout.workoutPlan} color={COLOR} />
```

Update the "Exercise Breakdown" header to reflect state:

```tsx
<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  {workout.workoutPlan && workout.workout.type === "rest"
    ? "Planned Workout"
    : "Exercise Breakdown"}
</h2>
```

**Step 2: Verify**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Clean compilation

**Step 3: Commit**

```bash
git add dashboard/src/app/(dashboard)/health/fitness/page.tsx
git commit -m "feat: wire workoutPlan through fitness page components"
```

---

## Task 13: Update nutrition skill docs

**Files:**
- Modify: `skills/nutrition.SKILL.md`

**Step 1: Add workout plan tools to Available Tools**

After the `nutrition_delete_meal_plan` entry, add:

```markdown
- `nutrition_save_workout_plan` — Save a daily workout plan with exercises and target sets/reps/weight (replaces existing plan for the date)
- `nutrition_save_workout_program` — Bulk-save a multi-day workout program (e.g. a week-long PPL split)
- `nutrition_get_workout_plan` — Retrieve workout plans for a date or date range
- `nutrition_delete_workout_plan` — Delete the workout plan for a specific date
```

**Step 2: Update the tool count in CLAUDE.md**

In `CLAUDE.md`, update the Nutrition Tracking row in the Development Kanban "Done" table:
- Change Tools count from 17 to 21 (adding 4 new tools)

**Step 3: Commit**

```bash
git add skills/nutrition.SKILL.md CLAUDE.md
git commit -m "docs: add workout plan tools to nutrition skill and kanban"
```

---

## Task 14: Full build verification

**Step 1: Backend build**

Run: `pnpm build`
Expected: Clean compilation, no errors

**Step 2: Dashboard type-check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Clean compilation, no errors

**Step 3: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address any remaining type issues from workout planning"
```
