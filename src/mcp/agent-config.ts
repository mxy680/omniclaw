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
  "gemini",
  "wolfram",
  "linkedin",
  "instagram",
  "framer",
  "x",
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
const GLOBAL_TOOLS = new Set(["view_attachment", "soul_read", "soul_write"]);

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

    // Create default soul.md if it doesn't exist
    const soulPath = path.join(agent.workspace, "soul.md");
    if (!fs.existsSync(soulPath)) {
      fs.writeFileSync(
        soulPath,
        DEFAULT_SOUL_TEMPLATE.replace("{{name}}", agent.name),
        "utf-8",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Soul
// ---------------------------------------------------------------------------

const DEFAULT_SOUL_TEMPLATE = `# Soul

## Identity
<!-- Who is {{name}}? What is their core purpose? -->

## Personality
<!-- How does {{name}} communicate? What's their tone and style? -->

## Expertise
<!-- What domains, skills, or knowledge areas does {{name}} specialize in? -->

## Goals
<!-- What does {{name}} aim to achieve? What are its priorities? -->

## Guidelines
<!-- Any rules, constraints, or preferences {{name}} should follow? -->
`;

// ---------------------------------------------------------------------------
// Gateway sync — keep openclaw.json agents.list in sync with agents.json
// ---------------------------------------------------------------------------

export function syncAgentsToGateway(agents: AgentConfig[]): void {
  const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
  if (!fs.existsSync(configPath)) return;

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return;
  }

  const agentsSection = (config.agents ?? {}) as Record<string, unknown>;
  const existingList = (agentsSection.list ?? []) as Array<Record<string, unknown>>;
  const existingById = new Map(existingList.map((a) => [a.id as string, a]));

  const synced = agents.map((a) => {
    const existing = existingById.get(a.id);
    // Build deny globs from services NOT in the agent's permissions
    const denyGlobs = VALID_SERVICES
      .filter((svc) => svc !== "schedule" && !a.permissions.services.includes(svc))
      .map((svc) => `${svc}_*`);
    const denyTools = a.permissions.denyTools ?? [];

    return {
      // Preserve any existing Gateway-specific fields (model overrides, etc.)
      ...(existing ?? {}),
      id: a.id,
      name: a.name,
      workspace: a.workspace,
      agentDir: path.join(a.workspace, "agent"),
      skills: a.permissions.services,
      ...(denyGlobs.length > 0 || denyTools.length > 0
        ? { tools: { deny: [...denyGlobs, ...denyTools] } }
        : {}),
    };
  });

  agentsSection.list = synced;
  config.agents = agentsSection;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function loadAgentSoul(agent: AgentConfig): string | null {
  const soulPath = path.join(agent.workspace, "soul.md");
  if (!fs.existsSync(soulPath)) return null;
  const content = fs.readFileSync(soulPath, "utf-8").trim();
  return content.length > 0 ? content : null;
}
