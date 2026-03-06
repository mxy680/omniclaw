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

export interface ConnectedDevice {
  name: string;
  osVersion: string;
  udid: string;
  modelName: string;
  available: boolean;
  error?: string;
}

export interface MobileStatus {
  metro: "running" | "stopped";
  metroPort: number;
  devices: ConnectedDevice[];
}

export interface TunnelStatus {
  running: boolean;
  url?: string;
  pid?: number;
}

export interface SystemStatus {
  gateway: GatewayStatus;
  mcpServer: McpServerStatus;
  mobile: MobileStatus;
  agents: AgentInfo[];
  lanIp: string;
  tunnel: TunnelStatus;
}
