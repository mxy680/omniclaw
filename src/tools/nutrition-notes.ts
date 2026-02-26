import { Type } from "@sinclair/typebox";
import type { NutritionDbManager } from "../nutrition/nutrition-db-manager.js";
import { jsonResult, todayStr } from "./nutrition-utils.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNutritionNotesTool(db: NutritionDbManager): any {
  return {
    name: "nutrition_notes",
    label: "Nutrition Notes",
    description:
      "Read or write daily nutrition notes. If 'content' is provided, upserts a note for the given date. If omitted, reads notes for the date range.",
    parameters: Type.Object({
      date: Type.Optional(
        Type.String({ description: "Date in YYYY-MM-DD format. Defaults to today." }),
      ),
      end: Type.Optional(
        Type.String({ description: "End date for reading a range (YYYY-MM-DD). Only used when reading." }),
      ),
      content: Type.Optional(
        Type.String({ description: "Note content to save. If provided, upserts a note for the date." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { date?: string; end?: string; content?: string },
    ) {
      try {
        const date = params.date ?? todayStr();

        if (params.content !== undefined) {
          const note = db.upsertNote(date, params.content);
          return jsonResult({ saved: note });
        }

        const end = params.end ?? date;
        const notes = db.getNotes(date, end);
        return jsonResult({ notes, count: notes.length });
      } catch (err) {
        return jsonResult({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
