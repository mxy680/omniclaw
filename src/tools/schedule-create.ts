import * as fs from "fs";
import * as path from "path";
import { Type } from "@sinclair/typebox";
import type { ScheduleStore } from "../scheduler/schedule-store.js";
import type { AgentConfig } from "../mcp/agent-config.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createScheduleCreateTool(store: ScheduleStore, agents: AgentConfig[]): any {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return {
    name: "schedule_create",
    label: "Schedule Create Job",
    description:
      "Create a new scheduled cron job for an agent. Provide a cron expression, instruction content (markdown), and the target agent. " +
      "The instruction content is saved as a markdown file in the agent's instructions/ directory.",
    parameters: Type.Object({
      id: Type.String({
        description: "Unique job ID (kebab-case, e.g. 'morning-briefing').",
      }),
      name: Type.String({
        description: "Human-readable job name (e.g. 'Morning Briefing').",
      }),
      agent_id: Type.String({
        description: "ID of the agent that will execute this job.",
      }),
      cron: Type.String({
        description:
          "Cron expression (5 or 6 fields). Examples: '0 8 * * 1-5' (weekdays 8am), '*/30 * * * *' (every 30 min).",
      }),
      instruction: Type.String({
        description: "Markdown instruction content the agent will execute on each run.",
      }),
      timezone: Type.Optional(
        Type.String({
          description: "IANA timezone (e.g. 'America/New_York'). Defaults to system timezone.",
        }),
      ),
      description: Type.Optional(
        Type.String({ description: "Optional description of what this job does." }),
      ),
      enabled: Type.Optional(
        Type.Boolean({ description: "Whether the job is enabled. Defaults to true." }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        id: string;
        name: string;
        agent_id: string;
        cron: string;
        instruction: string;
        timezone?: string;
        description?: string;
        enabled?: boolean;
      },
    ) {
      const agent = agentMap.get(params.agent_id);
      if (!agent) {
        return jsonResult({
          error: "agent_not_found",
          message: `Agent "${params.agent_id}" not found. Available agents: ${agents.map((a) => a.id).join(", ")}`,
        });
      }

      // Write instruction file
      const filename = `${params.id}.md`;
      const instructionsDir = path.join(agent.workspace, "instructions");
      fs.mkdirSync(instructionsDir, { recursive: true });
      fs.writeFileSync(path.join(instructionsDir, filename), params.instruction, "utf-8");

      const now = new Date().toISOString();
      try {
        store.createJob({
          id: params.id,
          name: params.name,
          agentId: params.agent_id,
          cron: params.cron,
          instructionFile: filename,
          enabled: params.enabled ?? true,
          timezone: params.timezone,
          description: params.description,
          createdAt: now,
          updatedAt: now,
        });
      } catch (err: unknown) {
        return jsonResult({
          error: "create_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }

      return jsonResult({
        success: true,
        job: {
          id: params.id,
          name: params.name,
          agentId: params.agent_id,
          cron: params.cron,
          instructionFile: filename,
          enabled: params.enabled ?? true,
          timezone: params.timezone ?? null,
          description: params.description ?? null,
        },
      });
    },
  };
}
