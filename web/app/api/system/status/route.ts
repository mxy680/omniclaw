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
  TunnelStatus,
} from "@/lib/system-types";

const execFileAsync = promisify(execFile);

// Cache slow xcrun results (takes ~6s) — refresh at most every 30s
let deviceCache: { devices: ConnectedDevice[]; ts: number } = { devices: [], ts: 0 };
const DEVICE_CACHE_TTL = 30_000;

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
  // Return cached result if fresh enough — xcrun takes ~6s
  if (Date.now() - deviceCache.ts < DEVICE_CACHE_TTL) {
    return deviceCache.devices;
  }
  try {
    const { stdout } = await execFileAsync("xcrun", ["xcdevice", "list"], {
      encoding: "utf-8",
      timeout: 10000,
    });

    const entries: XcdeviceEntry[] = JSON.parse(stdout);

    const devices = entries
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
    deviceCache = { devices, ts: Date.now() };
    return devices;
  } catch {
    return deviceCache.devices; // Return stale data on error
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

const TUNNEL_URL = "https://omniclaw.mxy680.net";

async function probeTunnel(): Promise<TunnelStatus> {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-f", "cloudflared tunnel"], {
      encoding: "utf-8",
      timeout: 2000,
    });
    const pid = parseInt(stdout.trim().split("\n")[0], 10);
    if (isNaN(pid)) return { running: false };

    return { running: true, url: TUNNEL_URL, pid };
  } catch {
    return { running: false };
  }
}

export async function GET() {
  const gwConfig = readGatewayConfig();
  const mcpPort = parseInt(process.env.OMNICLAW_MCP_PORT ?? "9850", 10);

  const [gateway, mcpServer, mobile, tunnel] = await Promise.all([
    probeGateway(gwConfig.port),
    probeMcpServer(mcpPort),
    probeMobile(),
    probeTunnel(),
  ]);

  const agents = readAgents();
  const lanIp = getLanIp();

  const status: SystemStatus = { gateway, mcpServer, mobile, agents, lanIp, tunnel };
  return NextResponse.json(status);
}
