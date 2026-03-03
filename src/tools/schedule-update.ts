import * as fs from "fs";
import * as path from "path";
import { Type } from "@sinclair/typebox";
import type { ScheduleStore } from "../scheduler/schedule-store.js";
import type { AgentConfig } from "../mcp/agent-config.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createScheduleUpdateTool(store: ScheduleStore, agents: AgentConfig[]): any {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return {
    name: "schedule_update",
    label: "Schedule Update Job",
    description:
      "Update an existing scheduled job. You can change the cron expression, name, instruction content, enabled status, or timezone. " +
      "Only provide the fields you want to change.",
    parameters: Type.Object({
      job_id: Type.String({ description: "The schedule job ID to update." }),
      name: Type.Optional(Type.String({ description: "New job name." })),
      cron: Type.Optional(Type.String({ description: "New cron expression." })),
      instruction: Type.Optional(
        Type.String({ description: "New instruction content (overwrites the markdown file)." }),
      ),
      enabled: Type.Optional(Type.Boolean({ description: "Enable or disable the job." })),
      timezone: Type.Optional(Type.String({ description: "New IANA timezone." })),
      description: Type.Optional(Type.String({ description: "New description." })),
    }),
    async execute(
      _toolCallId: string,
      params: {
        job_id: string;
        name?: string;
        cron?: string;
        instruction?: string;
        enabled?: boolean;
        timezone?: string;
        description?: string;
      },
    ) {
      const existing = store.getJob(params.job_id);
      if (!existing) {
        return jsonResult({
          error: "not_found",
          message: `Job "${params.job_id}" not found.`,
        });
      }

      // Update instruction file if new content provided
      if (params.instruction !== undefined) {
        const agent = agentMap.get(existing.agentId);
        if (agent) {
          const filePath = store.resolveInstructionPath(existing, agent.workspace);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, params.instruction, "utf-8");
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (params.name !== undefined) updates.name = params.name;
      if (params.cron !== undefined) updates.cron = params.cron;
      if (params.enabled !== undefined) updates.enabled = params.enabled;
      if (params.timezone !== undefined) updates.timezone = params.timezone;
      if (params.description !== undefined) updates.description = params.description;

      try {
        const updated = store.updateJob(params.job_id, updates);
        return jsonResult({ success: true, job: updated });
      } catch (err: unknown) {
        return jsonResult({
          error: "update_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}
