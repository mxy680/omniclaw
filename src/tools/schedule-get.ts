import * as fs from "fs";
import { Type } from "@sinclair/typebox";
import type { ScheduleStore } from "../scheduler/schedule-store.js";
import type { AgentConfig } from "../mcp/agent-config.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createScheduleGetTool(store: ScheduleStore, agents: AgentConfig[]): any {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return {
    name: "schedule_get",
    label: "Schedule Get Job",
    description:
      "Get full details of a scheduled job by ID, including its instruction file content.",
    parameters: Type.Object({
      job_id: Type.String({ description: "The schedule job ID." }),
    }),
    async execute(_toolCallId: string, params: { job_id: string }) {
      const job = store.getJob(params.job_id);
      if (!job) {
        return jsonResult({
          error: "not_found",
          message: `Job "${params.job_id}" not found.`,
        });
      }

      const agent = agentMap.get(job.agentId);
      let instruction: string | null = null;
      if (agent) {
        try {
          instruction = store.readInstruction(job, agent.workspace);
        } catch {
          instruction = null;
        }
      }

      return jsonResult({
        ...job,
        instruction,
      });
    },
  };
}
