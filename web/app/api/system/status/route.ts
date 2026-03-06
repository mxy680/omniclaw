import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir, networkInterfaces } from "os";
import net from "net";
import { execFile } from "child_process";
import { promisify } from "util";
import type {
  SystemStatus,
  GatewayStatus,
  McpServerStatus,
  MobileStatus,
  ConnectedDevice,
  AgentInfo,
  TailscaleStatus,
} from "@/lib/system-types";

const execFileAsync = promisify(execFile);

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

async function probePort(port: number, host = "127.0.0.1", timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
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
  // Always probe 127.0.0.1 — config.address may be a symbolic name like "lan"
  const running = await probePort(port, "127.0.0.1");
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
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
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

interface XcdeviceEntry {
  identifier: string;
  name: string;
  platform: string;
  available: boolean;
  operatingSystemVersion?: string;
  modelName?: string;
  error?: { recoverySuggestion?: string };
}

async function detectConnectedDevices(): Promise<ConnectedDevice[]> {
  try {
    const { stdout } = await execFileAsync("xcrun", ["xcdevice", "list"], {
      encoding: "utf-8",
      timeout: 10000,
    });

    const entries: XcdeviceEntry[] = JSON.parse(stdout);

    return entries
      .filter((d) => d.platform === "com.apple.platform.iphoneos")
      .map((d) => {
        const osMatch = d.operatingSystemVersion?.match(/^([\d.]+)/);
        return {
          name: d.name,
          osVersion: osMatch?.[1] ?? "unknown",
          udid: d.identifier,
          modelName: d.modelName ?? "",
          available: d.available,
          error: d.error?.recoverySuggestion,
        };
      });
  } catch {
    return [];
  }
}

async function probeMobile(): Promise<MobileStatus> {
  const metroPort = 8081;
  const [metroRunning, devices] = await Promise.all([
    probePort(metroPort),
    detectConnectedDevices(),
  ]);
  return {
    metro: metroRunning ? "running" : "stopped",
    metroPort,
    devices,
  };
}

async function probeTailscale(): Promise<TailscaleStatus> {
  try {
    const { stdout } = await execFileAsync("tailscale", ["status", "--json"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    const data = JSON.parse(stdout);
    const self = data.Self ?? {};
    const dnsName = (self.DNSName as string ?? "").replace(/\.$/, "");
    const tailscaleIp = (self.TailscaleIPs as string[] ?? [])[0];

    // Check funnel/serve config
    let funnelEnabled = false;
    let funnelUrl: string | undefined;
    try {
      const serveResult = await execFileAsync("tailscale", ["funnel", "status", "--json"], {
        encoding: "utf-8",
        timeout: 3000,
      });
      const serveData = JSON.parse(serveResult.stdout);
      if (serveData && typeof serveData === "object") {
        const webEntries = serveData.Web as Record<string, unknown> | undefined;
        const allFunnel = serveData.AllowFunnel as Record<string, boolean> | undefined;
        if (webEntries && Object.keys(webEntries).length > 0) {
          funnelEnabled = allFunnel ? Object.values(allFunnel).some(v => v) : false;
          if (funnelEnabled && dnsName) {
            funnelUrl = `wss://${dnsName}`;
          }
        }
      }
    } catch {
      // No serve config — funnel not enabled
    }

    return {
      installed: true,
      running: self.Online === true,
      hostname: dnsName || undefined,
      tailscaleIp,
      funnelEnabled,
      funnelUrl,
    };
  } catch {
    return { installed: false, running: false, funnelEnabled: false };
  }
}

export async function GET() {
  const gwConfig = readGatewayConfig();
  const mcpPort = parseInt(process.env.OMNICLAW_MCP_PORT ?? "9850", 10);

  const [gateway, mcpServer, mobile, tailscale] = await Promise.all([
    probeGateway(gwConfig.port),
    probeMcpServer(mcpPort),
    probeMobile(),
    probeTailscale(),
  ]);

  const agents = readAgents();
  const lanIp = getLanIp();

  const status: SystemStatus = { gateway, mcpServer, mobile, agents, lanIp, tailscale };
  return NextResponse.json(status);
}
