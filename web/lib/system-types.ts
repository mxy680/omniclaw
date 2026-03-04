export interface GatewayStatus {
  status: "running" | "stopped" | "error";
  port: number;
  address: string;
  authToken: string;
  error?: string;
}

export interface McpServerStatus {
  status: "running" | "stopped" | "error";
  port: number;
  tools?: number;
  sessions?: number;
  agents?: number;
  scheduler?: { enabled: boolean; jobs?: number; activeRuns?: number };
  error?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  colorName: string;
  services: string[];
}

export interface SystemStatus {
  gateway: GatewayStatus;
  mcpServer: McpServerStatus;
  agents: AgentInfo[];
  lanIp: string;
}
