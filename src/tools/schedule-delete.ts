import { Type } from "@sinclair/typebox";
import type { ScheduleStore } from "../scheduler/schedule-store.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createScheduleDeleteTool(store: ScheduleStore): any {
  return {
    name: "schedule_delete",
    label: "Schedule Delete Job",
    description: "Delete a scheduled job by ID. The instruction file on disk is not removed.",
    parameters: Type.Object({
      job_id: Type.String({ description: "The schedule job ID to delete." }),
    }),
    async execute(_toolCallId: string, params: { job_id: string }) {
      const existing = store.getJob(params.job_id);
      if (!existing) {
        return jsonResult({
          error: "not_found",
          message: `Job "${params.job_id}" not found.`,
        });
      }

      store.deleteJob(params.job_id);
      return jsonResult({
        success: true,
        message: `Job "${params.job_id}" deleted.`,
      });
    },
  };
}
