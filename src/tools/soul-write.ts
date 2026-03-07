import * as fs from "fs";
import * as path from "path";
import { Type } from "@sinclair/typebox";
import type { AgentConfig } from "../mcp/agent-config.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSoulWriteTool(agents: AgentConfig[]): any {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return {
    name: "soul_write",
    label: "Soul Write",
    description:
      "Write or update an agent's soul.md — the markdown document that defines the agent's identity, personality, expertise, goals, and guidelines.",
    parameters: Type.Object({
      agent_id: Type.String({
        description: "ID of the agent whose soul to write.",
      }),
      content: Type.String({
        description: "The full markdown content for the agent's soul.md.",
      }),
    }),
    async execute(_toolCallId: string, params: { agent_id: string; content: string }) {
      const agent = agentMap.get(params.agent_id);
      if (!agent) {
        return jsonResult({
          error: "agent_not_found",
          message: `Agent "${params.agent_id}" not found. Available agents: ${agents.map((a) => a.id).join(", ")}`,
        });
      }

      const soulPath = path.join(agent.workspace, "soul.md");
      fs.mkdirSync(path.dirname(soulPath), { recursive: true });
      fs.writeFileSync(soulPath, params.content, "utf-8");

      return jsonResult({
        success: true,
        agent_id: params.agent_id,
        path: soulPath,
      });
    },
  };
}
