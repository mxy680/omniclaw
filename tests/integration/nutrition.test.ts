/**
 * Integration tests for the local nutrition tracking system.
 *
 * Uses a temporary SQLite DB — no external APIs, no credentials needed.
 *
 * Run:
 *   pnpm vitest run tests/integration/nutrition.test.ts
 */

import { unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NutritionDbManager } from "../../src/nutrition/nutrition-db-manager.js";
import { createNutritionLogFoodTool } from "../../src/tools/nutrition-log-food.js";
import { createNutritionDiaryTool } from "../../src/tools/nutrition-diary.js";
import { createNutritionDeleteFoodTool } from "../../src/tools/nutrition-delete-food.js";
import { createNutritionLogExerciseTool } from "../../src/tools/nutrition-log-exercise.js";
import { createNutritionExercisesTool } from "../../src/tools/nutrition-exercises.js";
import { createNutritionDeleteExerciseTool } from "../../src/tools/nutrition-delete-exercise.js";
import { createNutritionLogBiometricTool } from "../../src/tools/nutrition-log-biometric.js";
import { createNutritionBiometricsTool } from "../../src/tools/nutrition-biometrics.js";
import { createNutritionNotesTool } from "../../src/tools/nutrition-notes.js";
import { createNutritionSetTargetsTool } from "../../src/tools/nutrition-set-targets.js";

const DB_PATH = join(tmpdir(), `nutrition-test-${Date.now()}.db`);
let db: NutritionDbManager;

beforeAll(() => {
  db = new NutritionDbManager(DB_PATH);
});

afterAll(() => {
  db.close();
  try { unlinkSync(DB_PATH); } catch { /* ignore */ }
  try { unlinkSync(DB_PATH + "-wal"); } catch { /* ignore */ }
  try { unlinkSync(DB_PATH + "-shm"); } catch { /* ignore */ }
});

// ── Helper to extract payload from tool result ──────────────────────
function payload(result: { content: Array<{ text: string }> }): Record<string, unknown> {
  return JSON.parse(result.content[0].text);
}

// ── NutritionDbManager direct tests ─────────────────────────────────

describe("NutritionDbManager", () => {
  describe("Food entries", () => {
    it("logs food entries and queries them back", () => {
      const entries = db.addFoodEntries([
        { date: "2026-01-15", meal: "breakfast", food_name: "Oatmeal", serving: "1 cup", calories: 300, protein_g: 10, carbs_g: 50, fat_g: 6, fiber_g: 5 },
        { date: "2026-01-15", meal: "breakfast", food_name: "Banana", serving: "1 medium", calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, sugar_g: 14 },
        { date: "2026-01-15", meal: "lunch", food_name: "Chicken Breast", serving: "200g", calories: 330, protein_g: 62, carbs_g: 0, fat_g: 7.2 },
      ]);

      expect(entries).toHaveLength(3);
      expect(entries[0].id).toBeGreaterThan(0);
      expect(entries[0].food_name).toBe("Oatmeal");

      const result = db.getFoodEntries("2026-01-15", "2026-01-15");
      expect(result.entries).toHaveLength(3);
    });

    it("computes daily totals correctly", () => {
      const { daily_totals } = db.getFoodEntries("2026-01-15", "2026-01-15");
      expect(daily_totals).toHaveLength(1);
      const total = daily_totals[0];
      expect(total.date).toBe("2026-01-15");
      expect(total.calories).toBeCloseTo(735, 0);
      expect(total.protein_g).toBeCloseTo(73.3, 0);
      expect(total.entry_count).toBe(3);
    });

    it("deletes food entry by id", () => {
      const entries = db.addFoodEntries([
        { date: "2026-01-16", food_name: "Apple", calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3 },
      ]);
      const deleted = db.deleteFoodEntry(entries[0].id);
      expect(deleted).toBe(true);

      const result = db.getFoodEntries("2026-01-16", "2026-01-16");
      expect(result.entries).toHaveLength(0);
    });

    it("returns false when deleting non-existent entry", () => {
      expect(db.deleteFoodEntry(99999)).toBe(false);
    });
  });

  describe("Exercises", () => {
    it("logs exercise with JSON details", () => {
      const entry = db.addExercise({
        date: "2026-01-15",
        name: "Bench Press",
        exercise_type: "strength",
        duration_min: 45,
        calories_burned: 200,
        details: { sets: 4, reps: 10, weight_lbs: 185 },
        notes: "Felt strong",
      });
      expect(entry.id).toBeGreaterThan(0);
      expect(entry.name).toBe("Bench Press");
      expect(entry.details).toEqual({ sets: 4, reps: 10, weight_lbs: 185 });
    });

    it("queries exercises by date range", () => {
      db.addExercise({ date: "2026-01-14", name: "Running", exercise_type: "cardio", duration_min: 30 });
      const exercises = db.getExercises("2026-01-14", "2026-01-15");
      expect(exercises.length).toBeGreaterThanOrEqual(2);
    });

    it("deletes exercise by id", () => {
      const entry = db.addExercise({ date: "2026-01-17", name: "Yoga", exercise_type: "flexibility" });
      expect(db.deleteExercise(entry.id)).toBe(true);
      expect(db.deleteExercise(entry.id)).toBe(false);
    });
  });

  describe("Biometrics", () => {
    it("logs biometric measurement", () => {
      const entry = db.addBiometric({ date: "2026-01-15", metric: "weight", value: 180, unit: "lbs" });
      expect(entry.id).toBeGreaterThan(0);
      expect(entry.metric).toBe("weight");
    });

    it("queries biometrics with metric filter", () => {
      db.addBiometric({ date: "2026-01-15", metric: "body_fat", value: 15, unit: "%" });
      db.addBiometric({ date: "2026-01-16", metric: "weight", value: 179.5, unit: "lbs" });

      const allMetrics = db.getBiometrics("2026-01-15", "2026-01-16");
      expect(allMetrics.length).toBeGreaterThanOrEqual(3);

      const weightOnly = db.getBiometrics("2026-01-15", "2026-01-16", "weight");
      expect(weightOnly.every((b) => b.metric === "weight")).toBe(true);
      expect(weightOnly.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Notes", () => {
    it("upserts note (create then update)", () => {
      const note1 = db.upsertNote("2026-01-15", "Felt great today");
      expect(note1.content).toBe("Felt great today");

      const note2 = db.upsertNote("2026-01-15", "Updated: felt great today, hit PRs");
      expect(note2.id).toBe(note1.id);
      expect(note2.content).toBe("Updated: felt great today, hit PRs");
    });

    it("queries notes by date range", () => {
      db.upsertNote("2026-01-16", "Rest day");
      const notes = db.getNotes("2026-01-15", "2026-01-16");
      expect(notes).toHaveLength(2);
    });
  });

  describe("Targets", () => {
    it("sets and retrieves active targets", () => {
      db.setTargets({ calories: 2200, protein_g: 180, carbs_g: 220, fat_g: 70 });
      const targets = db.getActiveTargets();
      expect(targets).not.toBeNull();
      expect(targets!.calories).toBe(2200);
      expect(targets!.protein_g).toBe(180);
    });

    it("replaces old targets when setting new ones", () => {
      db.setTargets({ calories: 2500, protein_g: 200 });
      const targets = db.getActiveTargets();
      expect(targets!.calories).toBe(2500);
      expect(targets!.protein_g).toBe(200);
      // Old fat_g should not carry over
      expect(targets!.fat_g).toBeUndefined();
    });
  });

  describe("Edge cases", () => {
    it("returns empty arrays for date ranges with no data", () => {
      const { entries, daily_totals } = db.getFoodEntries("2099-01-01", "2099-01-31");
      expect(entries).toHaveLength(0);
      expect(daily_totals).toHaveLength(0);

      expect(db.getExercises("2099-01-01", "2099-01-31")).toHaveLength(0);
      expect(db.getBiometrics("2099-01-01", "2099-01-31")).toHaveLength(0);
      expect(db.getNotes("2099-01-01", "2099-01-31")).toHaveLength(0);
    });
  });
});

// ── Tool wrapper tests ──────────────────────────────────────────────

describe("Tool wrappers", () => {
  it("nutrition_log_food returns logged entries and daily totals", async () => {
    const tool = createNutritionLogFoodTool(db);
    const result = await tool.execute("test-call", {
      entries: [
        { food_name: "Rice", calories: 200, protein_g: 4, carbs_g: 45, fat_g: 0.5 },
      ],
      meal: "dinner",
      date: "2026-02-01",
    });
    const data = payload(result);
    expect(data.logged).toBeDefined();
    expect((data.logged as unknown[]).length).toBe(1);
    expect(data.daily_totals).toBeDefined();
  });

  it("nutrition_diary returns grouped entries", async () => {
    const tool = createNutritionDiaryTool(db);
    const result = await tool.execute("test-call", {
      start: "2026-02-01",
      end: "2026-02-01",
    });
    const data = payload(result);
    expect(data.diary).toBeDefined();
    expect(data.daily_totals).toBeDefined();
  });

  it("nutrition_delete_food returns success/failure", async () => {
    const tool = createNutritionDeleteFoodTool(db);
    const result = await tool.execute("test-call", { id: 99999 });
    const data = payload(result);
    expect(data.success).toBe(false);
  });

  it("nutrition_log_exercise returns logged entry", async () => {
    const tool = createNutritionLogExerciseTool(db);
    const result = await tool.execute("test-call", {
      name: "Squats",
      exercise_type: "strength",
      date: "2026-02-01",
    });
    const data = payload(result);
    expect(data.logged).toBeDefined();
    expect((data.logged as Record<string, unknown>).name).toBe("Squats");
  });

  it("nutrition_exercises returns exercise list", async () => {
    const tool = createNutritionExercisesTool(db);
    const result = await tool.execute("test-call", {
      start: "2026-02-01",
      end: "2026-02-01",
    });
    const data = payload(result);
    expect(data.exercises).toBeDefined();
    expect(data.count).toBeGreaterThanOrEqual(1);
  });

  it("nutrition_delete_exercise returns success/failure", async () => {
    const tool = createNutritionDeleteExerciseTool(db);
    const result = await tool.execute("test-call", { id: 99999 });
    const data = payload(result);
    expect(data.success).toBe(false);
  });

  it("nutrition_log_biometric returns logged entry", async () => {
    const tool = createNutritionLogBiometricTool(db);
    const result = await tool.execute("test-call", {
      metric: "weight",
      value: 175,
      unit: "lbs",
      date: "2026-02-01",
    });
    const data = payload(result);
    expect((data.logged as Record<string, unknown>).metric).toBe("weight");
  });

  it("nutrition_biometrics returns biometric list", async () => {
    const tool = createNutritionBiometricsTool(db);
    const result = await tool.execute("test-call", {
      start: "2026-02-01",
      end: "2026-02-01",
    });
    const data = payload(result);
    expect(data.count).toBeGreaterThanOrEqual(1);
  });

  it("nutrition_notes upserts and reads notes", async () => {
    const tool = createNutritionNotesTool(db);

    // Write
    const writeResult = await tool.execute("test-call", {
      date: "2026-02-01",
      content: "Test note from tool wrapper",
    });
    const writeData = payload(writeResult);
    expect((writeData.saved as Record<string, unknown>).content).toBe("Test note from tool wrapper");

    // Read
    const readResult = await tool.execute("test-call", {
      date: "2026-02-01",
    });
    const readData = payload(readResult);
    expect(readData.count).toBeGreaterThanOrEqual(1);
  });

  it("nutrition_set_targets sets and returns targets", async () => {
    const tool = createNutritionSetTargetsTool(db);
    const result = await tool.execute("test-call", {
      calories: 2000,
      protein_g: 150,
    });
    const data = payload(result);
    expect((data.targets as Record<string, unknown>).calories).toBe(2000);
  });
});
