import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir, networkInterfaces } from "os";
import net from "net";
import { execFileSync } from "child_process";
import type {
  SystemStatus,
  GatewayStatus,
  McpServerStatus,
  MobileStatus,
  ConnectedDevice,
  AgentInfo,
} from "@/lib/system-types";

function getLanIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

function readGatewayConfig(): { port: number; address: string; authToken: string } {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  try {
    if (existsSync(configPath)) {
      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      return {
        port: raw?.gateway?.port ?? 18789,
        address: raw?.gateway?.bind ?? "localhost",
        authToken: raw?.gateway?.auth?.token ?? "",
      };
    }
  } catch {
    // ignore
  }
  return { port: 18789, address: "localhost", authToken: "" };
}

function readAgents(): AgentInfo[] {
  const agentsPath = join(homedir(), ".openclaw", "agents.json");
  try {
    if (existsSync(agentsPath)) {
      const raw = JSON.parse(readFileSync(agentsPath, "utf-8"));
      return (raw.agents ?? []).map(
        (a: Record<string, unknown>) => ({
          id: a.id as string,
          name: a.name as string,
          role: a.role as string,
          colorName: (a.colorName as string) ?? "blue",
          services: ((a.permissions as Record<string, unknown>)?.services as string[]) ?? [],
        }),
      );
    }
  } catch {
    // ignore
  }
  return [];
}

async function probePort(port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "localhost" });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function probeGateway(port: number): Promise<GatewayStatus> {
  const config = readGatewayConfig();
  const running = await probePort(port);
  return {
    status: running ? "running" : "stopped",
    port,
    address: config.address,
    authToken: config.authToken,
  };
}

async function probeMcpServer(port: number): Promise<McpServerStatus> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://localhost:${port}/health`, {
      signal: controller.signal,
      headers: { Authorization: "Bearer dev" },
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return {
        status: "running",
        port,
        tools: data.tools,
        sessions: data.sessions,
        agents: data.agents,
        scheduler: data.scheduler,
      };
    }
    return { status: "error", port, error: `HTTP ${res.status}` };
  } catch {
    return { status: "stopped", port };
  }
}

function detectConnectedDevices(): ConnectedDevice[] {
  try {
    const output = execFileSync("xcrun", ["xctrace", "list", "devices"], {
      encoding: "utf-8",
      timeout: 5000,
    });

    const devices: ConnectedDevice[] = [];
    let inDevices = false;

    for (const line of output.split("\n")) {
      if (line.startsWith("== Devices ==")) {
        inDevices = true;
        continue;
      }
      if (line.startsWith("== Devices Offline ==") || line.startsWith("== Simulators ==")) {
        break;
      }
      if (!inDevices) continue;

      // Format: "Name (OS Version) (UDID)"
      const match = line.match(/^(.+?)\s+\((\d+\.\d+(?:\.\d+)?)\)\s+\(([A-F0-9-]+)\)$/);
      if (match) {
        const name = match[1].trim();
        // Skip Macs — they show as devices but aren't mobile targets
        if (name.includes("MacBook") || name.includes("iMac") || name.includes("Mac ")) continue;
        devices.push({
          name,
          osVersion: match[2],
          udid: match[3],
        });
      }
    }

    return devices;
  } catch {
    return [];
  }
}

async function probeMobile(): Promise<MobileStatus> {
  const metroPort = 8081;
  const metroRunning = await probePort(metroPort);
  const devices = detectConnectedDevices();
  return {
    metro: metroRunning ? "running" : "stopped",
    metroPort,
    devices,
  };
}

export async function GET() {
  const gwConfig = readGatewayConfig();
  const mcpPort = parseInt(process.env.OMNICLAW_MCP_PORT ?? "9850", 10);

  const [gateway, mcpServer, mobile] = await Promise.all([
    probeGateway(gwConfig.port),
    probeMcpServer(mcpPort),
    probeMobile(),
  ]);

  const agents = readAgents();
  const lanIp = getLanIp();

  const status: SystemStatus = { gateway, mcpServer, mobile, agents, lanIp };
  return NextResponse.json(status);
}
