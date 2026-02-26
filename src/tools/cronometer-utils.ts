/**
 * Shared helpers for Cronometer tools.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentToolResult = any;

export function jsonResult(payload: unknown): AgentToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export const AUTH_REQUIRED = {
  error: "auth_required",
  action: "Call cronometer_auth_setup to authenticate with Cronometer first.",
};

/**
 * Parse CSV text into an array of objects.
 * First line is headers, subsequent lines are data.
 * Handles quoted fields with commas inside them.
 */
export function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const results: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    results.push(row);
  }

  return results;
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/** Parse a float from a CSV value, returning 0 for empty strings. */
export function parseFloat(val: string): number {
  if (!val || val.trim() === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/** Format a serving record from parsed CSV row into a clean object. */
export function formatServing(row: Record<string, string>): Record<string, unknown> {
  return {
    date: row["Day"] ?? row["Date"] ?? "",
    time: row["Time"] ?? "",
    group: row["Group"] ?? row["Meal"] ?? "",
    food_name: row["Food Name"] ?? row["Name"] ?? "",
    quantity: row["Amount"] ?? row["Quantity"] ?? "",
    unit: row["Unit"] ?? "",
    calories: parseFloat(row["Energy (kcal)"] ?? row["Calories"] ?? "0"),
    protein_g: parseFloat(row["Protein (g)"] ?? "0"),
    fat_g: parseFloat(row["Fat (g)"] ?? "0"),
    carbs_g: parseFloat(row["Carbs (g)"] ?? "0"),
    fiber_g: parseFloat(row["Fiber (g)"] ?? "0"),
    sugar_g: parseFloat(row["Sugars (g)"] ?? "0"),
    sodium_mg: parseFloat(row["Sodium (mg)"] ?? "0"),
    cholesterol_mg: parseFloat(row["Cholesterol (mg)"] ?? "0"),
    category: row["Category"] ?? "",
  };
}

/** Format a daily nutrition summary from parsed CSV row. */
export function formatDailySummary(row: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = { date: row["Date"] ?? row["Day"] ?? "" };
  for (const [key, val] of Object.entries(row)) {
    if (key === "Date" || key === "Day") continue;
    result[key] = parseFloat(val);
  }
  return result;
}

/** Format an exercise record from parsed CSV row. */
export function formatExercise(row: Record<string, string>): Record<string, unknown> {
  return {
    date: row["Day"] ?? row["Date"] ?? "",
    time: row["Time"] ?? "",
    exercise: row["Exercise Name"] ?? row["Exercise"] ?? "",
    minutes: parseFloat(row["Minutes"] ?? "0"),
    calories_burned: parseFloat(row["Calories Burned"] ?? "0"),
    group: row["Group"] ?? "",
  };
}

/** Format a biometric record from parsed CSV row. */
export function formatBiometric(row: Record<string, string>): Record<string, unknown> {
  return {
    date: row["Day"] ?? row["Date"] ?? "",
    time: row["Time"] ?? "",
    metric: row["Metric"] ?? row["Name"] ?? "",
    unit: row["Unit"] ?? "",
    amount: parseFloat(row["Amount"] ?? row["Value"] ?? "0"),
  };
}

/** Format a note record from parsed CSV row. */
export function formatNote(row: Record<string, string>): Record<string, unknown> {
  return {
    date: row["Day"] ?? row["Date"] ?? "",
    note: row["Note"] ?? row["Notes"] ?? "",
  };
}

/** Get today's date in YYYY-MM-DD format. */
export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

/** Get date N days ago in YYYY-MM-DD format. */
export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
