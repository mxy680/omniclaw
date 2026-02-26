/**
 * Integration tests for pantry inventory and meal planning.
 *
 * Uses a temporary SQLite DB — no external APIs, no credentials needed.
 *
 * Run:
 *   pnpm vitest run tests/integration/meal-planning.test.ts
 */

import { unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NutritionDbManager } from "../../src/nutrition/nutrition-db-manager.js";
import { createNutritionAddPantryItemTool } from "../../src/tools/nutrition-pantry-add.js";
import { createNutritionListPantryTool } from "../../src/tools/nutrition-pantry-list.js";
import { createNutritionUpdatePantryItemTool } from "../../src/tools/nutrition-pantry-update.js";
import { createNutritionRemovePantryItemTool } from "../../src/tools/nutrition-pantry-remove.js";
import { createNutritionSaveMealPlanTool } from "../../src/tools/nutrition-save-meal-plan.js";
import { createNutritionGetMealPlanTool } from "../../src/tools/nutrition-get-meal-plan.js";
import { createNutritionDeleteMealPlanTool } from "../../src/tools/nutrition-delete-meal-plan.js";

const DB_PATH = join(tmpdir(), `meal-planning-test-${Date.now()}.db`);
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

function payload(result: { content: Array<{ text: string }> }): Record<string, unknown> {
  return JSON.parse(result.content[0].text);
}

// ── Pantry CRUD ─────────────────────────────────────────────────────

describe("Pantry CRUD", () => {
  let itemId: number;

  it("adds a pantry item with defaults", () => {
    const item = db.addPantryItem({ name: "Greek Yogurt" });
    expect(item.id).toBeGreaterThan(0);
    expect(item.name).toBe("Greek Yogurt");
    expect(item.category).toBe("other");
    expect(item.quantity).toBe(1);
    expect(item.unit).toBe("item");
    itemId = item.id;
  });

  it("adds a pantry item with full details", () => {
    const item = db.addPantryItem({
      name: "Protein Bar",
      category: "snack",
      quantity: 12,
      unit: "bar",
      calories_per_serving: 200,
      protein_g_per_serving: 20,
      carbs_g_per_serving: 25,
      fat_g_per_serving: 8,
      serving_size: "1 bar",
      notes: "Kirkland brand",
    });
    expect(item.category).toBe("snack");
    expect(item.quantity).toBe(12);
    expect(item.calories_per_serving).toBe(200);
    expect(item.protein_g_per_serving).toBe(20);
  });

  it("lists all pantry items", () => {
    const items = db.listPantryItems();
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("filters pantry items by category", () => {
    db.addPantryItem({ name: "Chicken Breast", category: "protein", quantity: 3, unit: "lb" });
    const snacks = db.listPantryItems("snack");
    expect(snacks.every((i) => i.category === "snack")).toBe(true);
    expect(snacks.length).toBeGreaterThanOrEqual(1);
  });

  it("updates a pantry item", () => {
    const updated = db.updatePantryItem(itemId, { quantity: 5, category: "dairy" });
    expect(updated).not.toBeNull();
    expect(updated!.quantity).toBe(5);
    expect(updated!.category).toBe("dairy");
    expect(updated!.name).toBe("Greek Yogurt");
  });

  it("returns null when updating non-existent item", () => {
    expect(db.updatePantryItem(99999, { name: "Ghost" })).toBeNull();
  });

  it("deducts pantry quantity", () => {
    const item = db.addPantryItem({ name: "Eggs", quantity: 12, unit: "item" });
    const after = db.deductPantryQuantity(item.id, 3);
    expect(after).not.toBeNull();
    expect(after!.quantity).toBe(9);
  });

  it("removes pantry item when quantity reaches zero", () => {
    const item = db.addPantryItem({ name: "Last Apple", quantity: 1, unit: "item" });
    const after = db.deductPantryQuantity(item.id, 1);
    expect(after).not.toBeNull();
    expect(after!.quantity).toBe(0);
    // Item should be deleted from DB
    const items = db.listPantryItems();
    expect(items.find((i) => i.id === item.id)).toBeUndefined();
  });

  it("returns null when deducting from non-existent item", () => {
    expect(db.deductPantryQuantity(99999, 1)).toBeNull();
  });

  it("removes a pantry item by id", () => {
    const item = db.addPantryItem({ name: "To Remove" });
    expect(db.removePantryItem(item.id)).toBe(true);
    expect(db.removePantryItem(item.id)).toBe(false);
  });
});

// ── Meal Plan CRUD ──────────────────────────────────────────────────

describe("Meal Plan CRUD", () => {
  it("saves a meal plan for a date", () => {
    const entries = db.saveMealPlan("2026-03-01", [
      { date: "2026-03-01", time_slot: "08:00", meal_label: "Breakfast", source: "pantry", item_name: "Oatmeal", calories: 300, protein_g: 10, carbs_g: 50, fat_g: 6 },
      { date: "2026-03-01", time_slot: "12:30", meal_label: "Lunch", source: "factor75", source_id: "meal-123", item_name: "Chicken Tikka Masala", calories: 550, protein_g: 40, carbs_g: 45, fat_g: 20 },
      { date: "2026-03-01", time_slot: "18:30", meal_label: "Dinner", source: "factor75", source_id: "meal-456", item_name: "Salmon Bowl", calories: 600, protein_g: 45, carbs_g: 50, fat_g: 22 },
    ]);
    expect(entries).toHaveLength(3);
    expect(entries[0].id).toBeGreaterThan(0);
    expect(entries[0].time_slot).toBe("08:00");
    expect(entries[1].source).toBe("factor75");
  });

  it("gets a meal plan for a date", () => {
    const entries = db.getMealPlan("2026-03-01");
    expect(entries).toHaveLength(3);
    expect(entries[0].time_slot).toBe("08:00");
    expect(entries[2].time_slot).toBe("18:30");
  });

  it("upserts (replaces) meal plan for same date", () => {
    db.saveMealPlan("2026-03-01", [
      { date: "2026-03-01", time_slot: "08:00", meal_label: "Breakfast", source: "pantry", item_name: "Eggs & Toast", calories: 400, protein_g: 25, carbs_g: 30, fat_g: 18 },
    ]);
    const entries = db.getMealPlan("2026-03-01");
    expect(entries).toHaveLength(1);
    expect(entries[0].item_name).toBe("Eggs & Toast");
  });

  it("queries meal plan by date range", () => {
    db.saveMealPlan("2026-03-02", [
      { date: "2026-03-02", time_slot: "12:00", meal_label: "Lunch", source: "pantry", item_name: "Salad", calories: 350, protein_g: 20, carbs_g: 30, fat_g: 15 },
    ]);
    const entries = db.getMealPlanRange("2026-03-01", "2026-03-02");
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const dates = [...new Set(entries.map((e) => e.date))];
    expect(dates).toContain("2026-03-01");
    expect(dates).toContain("2026-03-02");
  });

  it("deletes meal plan for a date", () => {
    const count = db.deleteMealPlan("2026-03-01");
    expect(count).toBeGreaterThan(0);
    expect(db.getMealPlan("2026-03-01")).toHaveLength(0);
  });

  it("returns 0 when deleting non-existent plan", () => {
    expect(db.deleteMealPlan("2099-01-01")).toBe(0);
  });

  it("returns empty array for date with no plan", () => {
    expect(db.getMealPlan("2099-01-01")).toHaveLength(0);
  });
});

// ── Tool wrapper tests ──────────────────────────────────────────────

describe("Pantry tool wrappers", () => {
  it("nutrition_add_pantry_item returns the created item", async () => {
    const tool = createNutritionAddPantryItemTool(db);
    const result = await tool.execute("test", {
      name: "Almonds",
      category: "snack",
      quantity: 2,
      unit: "bag",
      calories_per_serving: 160,
      protein_g_per_serving: 6,
      carbs_g_per_serving: 6,
      fat_g_per_serving: 14,
    });
    const data = payload(result);
    expect(data.item).toBeDefined();
    const item = data.item as Record<string, unknown>;
    expect(item.name).toBe("Almonds");
    expect(item.category).toBe("snack");
  });

  it("nutrition_list_pantry returns items and count", async () => {
    const tool = createNutritionListPantryTool(db);
    const result = await tool.execute("test", {});
    const data = payload(result);
    expect(data.items).toBeDefined();
    expect(data.count).toBeGreaterThanOrEqual(1);
  });

  it("nutrition_list_pantry filters by category", async () => {
    const tool = createNutritionListPantryTool(db);
    const result = await tool.execute("test", { category: "snack" });
    const data = payload(result);
    const items = data.items as Array<Record<string, unknown>>;
    expect(items.every((i) => i.category === "snack")).toBe(true);
  });

  it("nutrition_update_pantry_item updates and returns item", async () => {
    const addTool = createNutritionAddPantryItemTool(db);
    const addResult = await addTool.execute("test", { name: "Bread" });
    const addData = payload(addResult);
    const id = (addData.item as Record<string, unknown>).id as number;

    const tool = createNutritionUpdatePantryItemTool(db);
    const result = await tool.execute("test", { id, quantity: 3, category: "grain" });
    const data = payload(result);
    const item = data.item as Record<string, unknown>;
    expect(item.quantity).toBe(3);
    expect(item.category).toBe("grain");
  });

  it("nutrition_update_pantry_item returns error for missing id", async () => {
    const tool = createNutritionUpdatePantryItemTool(db);
    const result = await tool.execute("test", { id: 99999, name: "Ghost" });
    const data = payload(result);
    expect(data.error).toBeDefined();
  });

  it("nutrition_remove_pantry_item returns success", async () => {
    const addTool = createNutritionAddPantryItemTool(db);
    const addResult = await addTool.execute("test", { name: "To Remove via Tool" });
    const id = (payload(addResult).item as Record<string, unknown>).id as number;

    const tool = createNutritionRemovePantryItemTool(db);
    const result = await tool.execute("test", { id });
    const data = payload(result);
    expect(data.success).toBe(true);
  });

  it("nutrition_remove_pantry_item returns failure for missing id", async () => {
    const tool = createNutritionRemovePantryItemTool(db);
    const result = await tool.execute("test", { id: 99999 });
    const data = payload(result);
    expect(data.success).toBe(false);
  });
});

describe("Meal plan tool wrappers", () => {
  it("nutrition_save_meal_plan saves and returns entries with totals", async () => {
    const tool = createNutritionSaveMealPlanTool(db);
    const result = await tool.execute("test", {
      date: "2026-04-01",
      entries: [
        { time_slot: "08:00", meal_label: "Breakfast", source: "pantry", item_name: "Oatmeal", calories: 300, protein_g: 10, carbs_g: 50, fat_g: 6 },
        { time_slot: "12:30", meal_label: "Lunch", source: "factor75", source_id: "m1", item_name: "Chicken Bowl", calories: 500, protein_g: 40, carbs_g: 40, fat_g: 18 },
      ],
    });
    const data = payload(result);
    expect(data.date).toBe("2026-04-01");
    expect((data.entries as unknown[]).length).toBe(2);
    const totals = data.totals as Record<string, number>;
    expect(totals.calories).toBe(800);
    expect(totals.protein_g).toBe(50);
  });

  it("nutrition_save_meal_plan with deduct_pantry deducts quantity", async () => {
    const pantryItem = db.addPantryItem({ name: "Deduct Test", quantity: 5 });

    const tool = createNutritionSaveMealPlanTool(db);
    await tool.execute("test", {
      date: "2026-04-02",
      entries: [
        { time_slot: "08:00", meal_label: "Breakfast", source: "pantry", source_id: String(pantryItem.id), item_name: "Deduct Test", calories: 100 },
      ],
      deduct_pantry: true,
    });

    const items = db.listPantryItems();
    const updated = items.find((i) => i.id === pantryItem.id);
    expect(updated).toBeDefined();
    expect(updated!.quantity).toBe(4);
  });

  it("nutrition_get_meal_plan returns single day plan", async () => {
    const tool = createNutritionGetMealPlanTool(db);
    const result = await tool.execute("test", { date: "2026-04-01" });
    const data = payload(result);
    expect(data.plans).toBeDefined();
    const plans = data.plans as Array<Record<string, unknown>>;
    expect(plans).toHaveLength(1);
    expect(plans[0].date).toBe("2026-04-01");
    expect((plans[0].entries as unknown[]).length).toBe(2);
  });

  it("nutrition_get_meal_plan returns range of plans", async () => {
    const tool = createNutritionGetMealPlanTool(db);
    const result = await tool.execute("test", { date: "2026-04-01", end: "2026-04-02" });
    const data = payload(result);
    const plans = data.plans as Array<Record<string, unknown>>;
    expect(plans.length).toBeGreaterThanOrEqual(2);
  });

  it("nutrition_delete_meal_plan deletes and returns count", async () => {
    const tool = createNutritionDeleteMealPlanTool(db);
    const result = await tool.execute("test", { date: "2026-04-01" });
    const data = payload(result);
    expect(data.deleted_count).toBeGreaterThan(0);

    // Verify deletion
    expect(db.getMealPlan("2026-04-01")).toHaveLength(0);
  });

  it("nutrition_delete_meal_plan returns 0 for non-existent date", async () => {
    const tool = createNutritionDeleteMealPlanTool(db);
    const result = await tool.execute("test", { date: "2099-01-01" });
    const data = payload(result);
    expect(data.deleted_count).toBe(0);
  });
});
