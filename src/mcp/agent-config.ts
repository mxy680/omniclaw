import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentPermissions {
  services: string[];
  denyTools?: string[];
}

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  colorName: string;
  permissions: AgentPermissions;
  workspace: string;
}

export interface AgentsFile {
  version: number;
  agents: AgentConfig[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VALID_SERVICES = [
  "gmail",
  "calendar",
  "drive",
  "docs",
  "sheets",
  "slides",
  "youtube",
  "schedule",
  "github",
] as const;

const DEFAULT_AGENTS_FILE: AgentsFile = {
  version: 1,
  agents: [
    {
      id: "markus",
      name: "Markus",
      role: "General Assistant",
      systemPrompt:
        "You are Markus, a helpful and knowledgeable general-purpose assistant. " +
        "You are concise, thoughtful, and direct. You help with coding, writing, " +
        "research, planning, and any other task.",
      colorName: "blue",
      permissions: { services: [...VALID_SERVICES] as string[] },
      workspace: path.join(os.homedir(), ".openclaw", "agents", "markus"),
    },
  ],
};

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function defaultAgentsPath(): string {
  return path.join(os.homedir(), ".openclaw", "agents.json");
}

export function loadAgentConfigs(agentsPath?: string): AgentsFile {
  const filePath = agentsPath ?? defaultAgentsPath();

  if (!fs.existsSync(filePath)) {
    return DEFAULT_AGENTS_FILE;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as AgentsFile;

  // Resolve ~ and validate services
  for (const agent of parsed.agents) {
    if (agent.workspace.startsWith("~")) {
      agent.workspace = agent.workspace.replace(/^~/, os.homedir());
    }
    for (const svc of agent.permissions.services) {
      if (!(VALID_SERVICES as readonly string[]).includes(svc)) {
        console.warn(`[agents] Unknown service "${svc}" in agent "${agent.id}" — ignoring.`);
      }
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Permission logic
// ---------------------------------------------------------------------------

export function getToolService(toolName: string): string {
  return toolName.split("_")[0];
}

/** Tools that are always available regardless of agent service permissions. */
const GLOBAL_TOOLS = new Set(["view_attachment"]);

export function isToolAllowed(toolName: string, permissions: AgentPermissions): boolean {
  if (GLOBAL_TOOLS.has(toolName)) {
    return true;
  }

  const service = getToolService(toolName);

  if (!permissions.services.includes(service)) {
    return false;
  }

  if (permissions.denyTools?.includes(toolName)) {
    return false;
  }

  return true;
}

export function filterToolsForAgent<T extends { name: string }>(
  allTools: T[],
  agentConfig: AgentConfig,
): T[] {
  return allTools.filter((t) => isToolAllowed(t.name, agentConfig.permissions));
}

// ---------------------------------------------------------------------------
// Workspace management
// ---------------------------------------------------------------------------

export function ensureAgentWorkspaces(agents: AgentConfig[]): void {
  for (const agent of agents) {
    const dirs = [
      agent.workspace,
      path.join(agent.workspace, "memories"),
      path.join(agent.workspace, "conversations"),
      path.join(agent.workspace, "config"),
      path.join(agent.workspace, "instructions"),
      path.join(agent.workspace, "schedule-results"),
    ];
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
