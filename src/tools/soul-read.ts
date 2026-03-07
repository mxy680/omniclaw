import { Type } from "@sinclair/typebox";
import { type AgentConfig, loadAgentSoul } from "../mcp/agent-config.js";
import { jsonResult } from "./shared.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSoulReadTool(agents: AgentConfig[]): any {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return {
    name: "soul_read",
    label: "Soul Read",
    description:
      "Read an agent's soul.md — the markdown document that defines the agent's identity, personality, expertise, goals, and guidelines.",
    parameters: Type.Object({
      agent_id: Type.String({
        description: "ID of the agent whose soul to read.",
      }),
    }),
    async execute(_toolCallId: string, params: { agent_id: string }) {
      const agent = agentMap.get(params.agent_id);
      if (!agent) {
        return jsonResult({
          error: "agent_not_found",
          message: `Agent "${params.agent_id}" not found. Available agents: ${agents.map((a) => a.id).join(", ")}`,
        });
      }

      const soul = loadAgentSoul(agent);
      if (!soul) {
        return jsonResult({
          agent_id: params.agent_id,
          soul: null,
          message: "No soul.md found for this agent.",
        });
      }

      return jsonResult({
        agent_id: params.agent_id,
        soul,
      });
    },
  };
}
