# Nutrition Tracking

10 tools for local nutrition tracking — log food, exercise, biometrics, and daily notes. All data stored in a local SQLite database with no external API or authentication.

## Architecture

- **Storage:** SQLite via `better-sqlite3` with WAL mode
- **Location:** `~/.openclaw/omniclaw-nutrition.db` (configurable)
- **Auth:** None — fully local
- **Performance:** Sub-millisecond queries with indexed tables

## Configuration

The only optional config is the database path:

```bash
openclaw config set plugins.entries.omniclaw.config.nutrition_db_path "/custom/path/nutrition.db"
```

If not set, defaults to `~/.openclaw/omniclaw-nutrition.db`.

## Tools

| Tool | Description |
|------|-------------|
| `nutrition_log_food` | Log one or more food entries with macros |
| `nutrition_diary` | Query food diary with daily totals and targets |
| `nutrition_delete_food` | Delete a food entry by ID |
| `nutrition_log_exercise` | Log an exercise session with optional details |
| `nutrition_exercises` | Query exercise entries for a date range |
| `nutrition_delete_exercise` | Delete an exercise entry by ID |
| `nutrition_log_biometric` | Log a biometric measurement |
| `nutrition_biometrics` | Query biometrics, optionally filtered by metric |
| `nutrition_notes` | Read or write daily nutrition notes |
| `nutrition_set_targets` | Set daily macro/calorie targets |

## Schema

### food_entries

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Auto-increment primary key |
| date | TEXT | YYYY-MM-DD, indexed |
| meal | TEXT | breakfast, lunch, dinner, snack, other |
| food_name | TEXT | Required |
| serving | TEXT | e.g. "1 cup", "200g" |
| calories | REAL | Required |
| protein_g | REAL | Required |
| carbs_g | REAL | Required |
| fat_g | REAL | Required |
| fiber_g | REAL | Optional |
| sugar_g | REAL | Optional |
| sodium_mg | REAL | Optional |
| notes | TEXT | Optional |
| created_at | TEXT | Auto-set |

### exercises

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Auto-increment primary key |
| date | TEXT | YYYY-MM-DD, indexed |
| name | TEXT | Required |
| exercise_type | TEXT | cardio, strength, flexibility, other |
| duration_min | REAL | Optional |
| calories_burned | REAL | Optional |
| details | TEXT | JSON blob for sets/reps, distance, etc. |
| notes | TEXT | Optional |
| created_at | TEXT | Auto-set |

### biometrics

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Auto-increment primary key |
| date | TEXT | YYYY-MM-DD, indexed |
| metric | TEXT | weight, body_fat, blood_pressure, resting_hr, etc. |
| value | REAL | Required |
| unit | TEXT | lbs, kg, %, mmHg, bpm, etc. |
| notes | TEXT | Optional |
| created_at | TEXT | Auto-set |

### notes

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Auto-increment primary key |
| date | TEXT | YYYY-MM-DD, UNIQUE |
| content | TEXT | Required |
| created_at | TEXT | Auto-set |
| updated_at | TEXT | Auto-set, updated on upsert |

### nutrition_targets

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Auto-increment primary key |
| calories | REAL | Optional |
| protein_g | REAL | Optional |
| carbs_g | REAL | Optional |
| fat_g | REAL | Optional |
| fiber_g | REAL | Optional |
| sodium_mg | REAL | Optional |
| active | INTEGER | 1 = active, 0 = replaced |
| created_at | TEXT | Auto-set |
