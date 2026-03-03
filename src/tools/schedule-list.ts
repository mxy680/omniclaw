import { Type } from "@sinclair/typebox";
import type { ScheduleStore } from "../scheduler/schedule-store.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createScheduleListTool(store: ScheduleStore): any {
  return {
    name: "schedule_list",
    label: "Schedule List Jobs",
    description:
      "List all scheduled cron jobs. Returns each job's ID, name, agent, cron expression, enabled status, and next run time.",
    parameters: Type.Object({
      agent_id: Type.Optional(
        Type.String({ description: "Filter jobs by agent ID. If omitted, returns all jobs." }),
      ),
      enabled_only: Type.Optional(
        Type.Boolean({ description: "If true, only return enabled jobs. Defaults to false." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { agent_id?: string; enabled_only?: boolean },
    ) {
      let jobs = store.listJobs();

      if (params.agent_id) {
        jobs = jobs.filter((j) => j.agentId === params.agent_id);
      }
      if (params.enabled_only) {
        jobs = jobs.filter((j) => j.enabled);
      }

      return jsonResult({
        count: jobs.length,
        jobs: jobs.map((j) => ({
          id: j.id,
          name: j.name,
          agentId: j.agentId,
          cron: j.cron,
          instructionFile: j.instructionFile,
          enabled: j.enabled,
          timezone: j.timezone ?? null,
          description: j.description ?? null,
        })),
      });
    },
  };
}
