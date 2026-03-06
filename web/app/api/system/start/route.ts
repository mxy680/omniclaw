import { NextResponse } from "next/server";
import { spawn, execFileSync } from "child_process";
import { join } from "path";
import { openSync, readFileSync, writeFileSync, existsSync } from "fs";
import { tmpdir, homedir } from "os";
import net from "net";

const PROJECT_ROOT = join(process.cwd(), "..");
const BUILD_LOG = join(tmpdir(), "omniclaw-ios-build.log");

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1500);
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const body = await request.json();
  const service = body.service as string;

  if (service === "gateway") {
    if (await isPortOpen(18789)) {
      return NextResponse.json({ error: "Gateway already running" }, { status: 409 });
    }

    const child = spawn("openclaw", ["gateway"], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    child.unref();

    await sleep(2500);
    const running = await isPortOpen(18789);
    return NextResponse.json({
      status: running ? "started" : "starting",
      pid: child.pid,
    });
  }

  if (service === "mcp-server") {
    if (await isPortOpen(9850)) {
      return NextResponse.json({ error: "MCP server already running" }, { status: 409 });
    }

    const child = spawn("npx", ["tsx", "src/mcp-server.ts"], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, OMNICLAW_MCP_TOKEN: "dev" },
    });
    child.unref();

    await sleep(2500);
    const running = await isPortOpen(9850);
    return NextResponse.json({
      status: running ? "started" : "starting",
      pid: child.pid,
    });
  }

  if (service === "mobile-ios") {
    const mobileDir = join(PROJECT_ROOT, "mobile");
    const udid = (body.udid as string) || undefined;

    const args = ["expo", "run:ios", "--device"];
    if (udid) {
      args.push(udid);
    }

    // Write build output to a log file so progress can be tracked
    const logFd = openSync(BUILD_LOG, "w");

    const child = spawn("npx", args, {
      cwd: mobileDir,
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        LANG: "en_US.UTF-8",
        LC_ALL: "en_US.UTF-8",
      },
    });
    child.unref();

    return NextResponse.json({
      status: "building",
      pid: child.pid,
      logFile: BUILD_LOG,
    });
  }

  if (service === "tailscale-funnel") {
    const gwPort = (body.port as number) || 18789;

    // Enable Tailscale Funnel for the gateway port
    try {
      execFileSync("tailscale", ["funnel", String(gwPort)], {
        encoding: "utf-8",
        timeout: 10000,
        env: { ...process.env },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to enable funnel";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Read the current gateway config and set tailscale mode
    const configPath = join(homedir(), ".openclaw", "openclaw.json");
    try {
      let config: Record<string, unknown> = {};
      if (existsSync(configPath)) {
        config = JSON.parse(readFileSync(configPath, "utf-8"));
      }
      const gw = (config.gateway ?? {}) as Record<string, unknown>;
      gw.tailscale = { mode: "funnel" };
      config.gateway = gw;
      writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch {
      // Config write is best-effort; funnel is already enabled via CLI
    }

    return NextResponse.json({ status: "enabled" });
  }

  return NextResponse.json(
    { error: `Unknown service: ${service}` },
    { status: 400 },
  );
}
