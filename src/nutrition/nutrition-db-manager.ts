import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";
import type {
  FoodEntryInput,
  FoodEntry,
  DailyTotal,
  ExerciseInput,
  ExerciseEntry,
  BiometricInput,
  BiometricEntry,
  NoteEntry,
  NutritionTargets,
  PantryItemInput,
  PantryItem,
  MealPlanEntryInput,
  MealPlanEntry,
  WorkoutPlanEntryInput,
  WorkoutPlanEntry,
} from "./types.js";

export class NutritionDbManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS food_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        meal TEXT,
        food_name TEXT NOT NULL,
        serving TEXT,
        calories REAL NOT NULL,
        protein_g REAL NOT NULL,
        carbs_g REAL NOT NULL,
        fat_g REAL NOT NULL,
        fiber_g REAL,
        sugar_g REAL,
        sodium_mg REAL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_food_entries_date ON food_entries(date);
      CREATE INDEX IF NOT EXISTS idx_food_entries_date_meal ON food_entries(date, meal);

      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        exercise_type TEXT,
        duration_min REAL,
        calories_burned REAL,
        details TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_exercises_date ON exercises(date);

      CREATE TABLE IF NOT EXISTS biometrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_biometrics_date ON biometrics(date);
      CREATE INDEX IF NOT EXISTS idx_biometrics_metric_date ON biometrics(metric, date);

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);

      CREATE TABLE IF NOT EXISTS nutrition_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        calories REAL,
        protein_g REAL,
        carbs_g REAL,
        fat_g REAL,
        fiber_g REAL,
        sodium_mg REAL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pantry_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        quantity REAL NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'item',
        calories_per_serving REAL,
        protein_g_per_serving REAL,
        carbs_g_per_serving REAL,
        fat_g_per_serving REAL,
        serving_size TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_pantry_items_category ON pantry_items(category);

      CREATE TABLE IF NOT EXISTS meal_plan_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        meal_label TEXT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT,
        item_name TEXT NOT NULL,
        calories REAL,
        protein_g REAL,
        carbs_g REAL,
        fat_g REAL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_meal_plan_date ON meal_plan_entries(date);

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
    `);
  }

  addFoodEntries(entries: FoodEntryInput[]): FoodEntry[] {
    const insert = this.db.prepare(`
      INSERT INTO food_entries (date, meal, food_name, serving, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, notes)
      VALUES (@date, @meal, @food_name, @serving, @calories, @protein_g, @carbs_g, @fat_g, @fiber_g, @sugar_g, @sodium_mg, @notes)
    `);

    const results: FoodEntry[] = [];
    const txn = this.db.transaction(() => {
      for (const entry of entries) {
        const info = insert.run({
          date: entry.date,
          meal: entry.meal ?? null,
          food_name: entry.food_name,
          serving: entry.serving ?? null,
          calories: entry.calories,
          protein_g: entry.protein_g,
          carbs_g: entry.carbs_g,
          fat_g: entry.fat_g,
          fiber_g: entry.fiber_g ?? null,
          sugar_g: entry.sugar_g ?? null,
          sodium_mg: entry.sodium_mg ?? null,
          notes: entry.notes ?? null,
        });
        results.push({ ...entry, id: Number(info.lastInsertRowid), created_at: new Date().toISOString() });
      }
    });
    txn();
    return results;
  }

  getFoodEntries(start: string, end: string): { entries: FoodEntry[]; daily_totals: DailyTotal[] } {
    const entries = this.db
      .prepare(`SELECT * FROM food_entries WHERE date >= ? AND date <= ? ORDER BY date, meal, id`)
      .all(start, end) as FoodEntry[];

    const daily_totals = this.db
      .prepare(
        `SELECT date,
          SUM(calories) as calories,
          SUM(protein_g) as protein_g,
          SUM(carbs_g) as carbs_g,
          SUM(fat_g) as fat_g,
          COALESCE(SUM(fiber_g), 0) as fiber_g,
          COALESCE(SUM(sugar_g), 0) as sugar_g,
          COALESCE(SUM(sodium_mg), 0) as sodium_mg,
          COUNT(*) as entry_count
        FROM food_entries
        WHERE date >= ? AND date <= ?
        GROUP BY date
        ORDER BY date`,
      )
      .all(start, end) as DailyTotal[];

    return { entries, daily_totals };
  }

  deleteFoodEntry(id: number): boolean {
    const info = this.db.prepare(`DELETE FROM food_entries WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  addExercise(entry: ExerciseInput): ExerciseEntry {
    const info = this.db
      .prepare(
        `INSERT INTO exercises (date, name, exercise_type, duration_min, calories_burned, details, notes)
         VALUES (@date, @name, @exercise_type, @duration_min, @calories_burned, @details, @notes)`,
      )
      .run({
        date: entry.date,
        name: entry.name,
        exercise_type: entry.exercise_type ?? null,
        duration_min: entry.duration_min ?? null,
        calories_burned: entry.calories_burned ?? null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        notes: entry.notes ?? null,
      });

    return {
      ...entry,
      id: Number(info.lastInsertRowid),
      created_at: new Date().toISOString(),
    };
  }

  getExercises(start: string, end: string): ExerciseEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM exercises WHERE date >= ? AND date <= ? ORDER BY date, id`)
      .all(start, end) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      ...row,
      details: row.details ? JSON.parse(row.details as string) : undefined,
    })) as ExerciseEntry[];
  }

  deleteExercise(id: number): boolean {
    const info = this.db.prepare(`DELETE FROM exercises WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  addBiometric(entry: BiometricInput): BiometricEntry {
    const info = this.db
      .prepare(
        `INSERT INTO biometrics (date, metric, value, unit, notes)
         VALUES (@date, @metric, @value, @unit, @notes)`,
      )
      .run({
        date: entry.date,
        metric: entry.metric,
        value: entry.value,
        unit: entry.unit,
        notes: entry.notes ?? null,
      });

    return {
      ...entry,
      id: Number(info.lastInsertRowid),
      created_at: new Date().toISOString(),
    };
  }

  getBiometrics(start: string, end: string, metric?: string): BiometricEntry[] {
    if (metric) {
      return this.db
        .prepare(
          `SELECT * FROM biometrics WHERE date >= ? AND date <= ? AND metric = ? ORDER BY date, id`,
        )
        .all(start, end, metric) as BiometricEntry[];
    }
    return this.db
      .prepare(`SELECT * FROM biometrics WHERE date >= ? AND date <= ? ORDER BY date, id`)
      .all(start, end) as BiometricEntry[];
  }

  upsertNote(date: string, content: string): NoteEntry {
    this.db
      .prepare(
        `INSERT INTO notes (date, content) VALUES (?, ?)
         ON CONFLICT(date) DO UPDATE SET content = excluded.content, updated_at = datetime('now')`,
      )
      .run(date, content);

    return this.db.prepare(`SELECT * FROM notes WHERE date = ?`).get(date) as NoteEntry;
  }

  getNotes(start: string, end: string): NoteEntry[] {
    return this.db
      .prepare(`SELECT * FROM notes WHERE date >= ? AND date <= ? ORDER BY date`)
      .all(start, end) as NoteEntry[];
  }

  setTargets(targets: NutritionTargets): void {
    const txn = this.db.transaction(() => {
      this.db.prepare(`UPDATE nutrition_targets SET active = 0 WHERE active = 1`).run();
      this.db
        .prepare(
          `INSERT INTO nutrition_targets (calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg)
           VALUES (@calories, @protein_g, @carbs_g, @fat_g, @fiber_g, @sodium_mg)`,
        )
        .run({
          calories: targets.calories ?? null,
          protein_g: targets.protein_g ?? null,
          carbs_g: targets.carbs_g ?? null,
          fat_g: targets.fat_g ?? null,
          fiber_g: targets.fiber_g ?? null,
          sodium_mg: targets.sodium_mg ?? null,
        });
    });
    txn();
  }

  getActiveTargets(): NutritionTargets | null {
    const row = this.db
      .prepare(`SELECT * FROM nutrition_targets WHERE active = 1 ORDER BY id DESC LIMIT 1`)
      .get() as Record<string, unknown> | undefined;

    if (!row) return null;

    const targets: NutritionTargets = {};
    if (row.calories != null) targets.calories = row.calories as number;
    if (row.protein_g != null) targets.protein_g = row.protein_g as number;
    if (row.carbs_g != null) targets.carbs_g = row.carbs_g as number;
    if (row.fat_g != null) targets.fat_g = row.fat_g as number;
    if (row.fiber_g != null) targets.fiber_g = row.fiber_g as number;
    if (row.sodium_mg != null) targets.sodium_mg = row.sodium_mg as number;
    return targets;
  }

  // ── Pantry ────────────────────────────────────────────

  addPantryItem(item: PantryItemInput): PantryItem {
    const info = this.db
      .prepare(
        `INSERT INTO pantry_items (name, category, quantity, unit, calories_per_serving, protein_g_per_serving, carbs_g_per_serving, fat_g_per_serving, serving_size, notes)
         VALUES (@name, @category, @quantity, @unit, @calories_per_serving, @protein_g_per_serving, @carbs_g_per_serving, @fat_g_per_serving, @serving_size, @notes)`,
      )
      .run({
        name: item.name,
        category: item.category ?? "other",
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "item",
        calories_per_serving: item.calories_per_serving ?? null,
        protein_g_per_serving: item.protein_g_per_serving ?? null,
        carbs_g_per_serving: item.carbs_g_per_serving ?? null,
        fat_g_per_serving: item.fat_g_per_serving ?? null,
        serving_size: item.serving_size ?? null,
        notes: item.notes ?? null,
      });

    return this.db
      .prepare(`SELECT * FROM pantry_items WHERE id = ?`)
      .get(Number(info.lastInsertRowid)) as PantryItem;
  }

  listPantryItems(category?: string): PantryItem[] {
    if (category) {
      return this.db
        .prepare(`SELECT * FROM pantry_items WHERE category = ? ORDER BY name`)
        .all(category) as PantryItem[];
    }
    return this.db
      .prepare(`SELECT * FROM pantry_items ORDER BY category, name`)
      .all() as PantryItem[];
  }

  updatePantryItem(id: number, updates: Partial<PantryItemInput>): PantryItem | null {
    const existing = this.db
      .prepare(`SELECT * FROM pantry_items WHERE id = ?`)
      .get(id) as PantryItem | undefined;
    if (!existing) return null;

    const merged = {
      name: updates.name ?? existing.name,
      category: updates.category ?? existing.category,
      quantity: updates.quantity ?? existing.quantity,
      unit: updates.unit ?? existing.unit,
      calories_per_serving: updates.calories_per_serving ?? existing.calories_per_serving,
      protein_g_per_serving: updates.protein_g_per_serving ?? existing.protein_g_per_serving,
      carbs_g_per_serving: updates.carbs_g_per_serving ?? existing.carbs_g_per_serving,
      fat_g_per_serving: updates.fat_g_per_serving ?? existing.fat_g_per_serving,
      serving_size: updates.serving_size ?? existing.serving_size,
      notes: updates.notes ?? existing.notes,
    };

    this.db
      .prepare(
        `UPDATE pantry_items SET name=@name, category=@category, quantity=@quantity, unit=@unit,
         calories_per_serving=@calories_per_serving, protein_g_per_serving=@protein_g_per_serving,
         carbs_g_per_serving=@carbs_g_per_serving, fat_g_per_serving=@fat_g_per_serving,
         serving_size=@serving_size, notes=@notes, updated_at=datetime('now')
         WHERE id=@id`,
      )
      .run({ ...merged, id });

    return this.db
      .prepare(`SELECT * FROM pantry_items WHERE id = ?`)
      .get(id) as PantryItem;
  }

  removePantryItem(id: number): boolean {
    const info = this.db.prepare(`DELETE FROM pantry_items WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  deductPantryQuantity(id: number, amount: number): PantryItem | null {
    const item = this.db
      .prepare(`SELECT * FROM pantry_items WHERE id = ?`)
      .get(id) as PantryItem | undefined;
    if (!item) return null;

    const newQty = Math.max(0, item.quantity - amount);
    if (newQty === 0) {
      this.db.prepare(`DELETE FROM pantry_items WHERE id = ?`).run(id);
      return { ...item, quantity: 0 };
    }

    this.db
      .prepare(`UPDATE pantry_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newQty, id);

    return this.db
      .prepare(`SELECT * FROM pantry_items WHERE id = ?`)
      .get(id) as PantryItem;
  }

  // ── Meal Plan ────────────────────────────────────────

  saveMealPlan(date: string, entries: MealPlanEntryInput[]): MealPlanEntry[] {
    const results: MealPlanEntry[] = [];
    const txn = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM meal_plan_entries WHERE date = ?`).run(date);

      const insert = this.db.prepare(
        `INSERT INTO meal_plan_entries (date, time_slot, meal_label, source, source_id, item_name, calories, protein_g, carbs_g, fat_g, notes)
         VALUES (@date, @time_slot, @meal_label, @source, @source_id, @item_name, @calories, @protein_g, @carbs_g, @fat_g, @notes)`,
      );

      for (const e of entries) {
        const info = insert.run({
          date,
          time_slot: e.time_slot,
          meal_label: e.meal_label,
          source: e.source,
          source_id: e.source_id ?? null,
          item_name: e.item_name,
          calories: e.calories ?? null,
          protein_g: e.protein_g ?? null,
          carbs_g: e.carbs_g ?? null,
          fat_g: e.fat_g ?? null,
          notes: e.notes ?? null,
        });
        results.push({
          id: Number(info.lastInsertRowid),
          date,
          time_slot: e.time_slot,
          meal_label: e.meal_label,
          source: e.source,
          source_id: e.source_id ?? null,
          item_name: e.item_name,
          calories: e.calories ?? null,
          protein_g: e.protein_g ?? null,
          carbs_g: e.carbs_g ?? null,
          fat_g: e.fat_g ?? null,
          notes: e.notes ?? null,
          created_at: new Date().toISOString(),
        });
      }
    });
    txn();
    return results;
  }

  getMealPlan(date: string): MealPlanEntry[] {
    return this.db
      .prepare(`SELECT * FROM meal_plan_entries WHERE date = ? ORDER BY time_slot, id`)
      .all(date) as MealPlanEntry[];
  }

  getMealPlanRange(start: string, end: string): MealPlanEntry[] {
    return this.db
      .prepare(
        `SELECT * FROM meal_plan_entries WHERE date >= ? AND date <= ? ORDER BY date, time_slot, id`,
      )
      .all(start, end) as MealPlanEntry[];
  }

  deleteMealPlan(date: string): number {
    const info = this.db.prepare(`DELETE FROM meal_plan_entries WHERE date = ?`).run(date);
    return info.changes;
  }

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

  close(): void {
    this.db.close();
  }
}
