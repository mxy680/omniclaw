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

  close(): void {
    this.db.close();
  }
}
