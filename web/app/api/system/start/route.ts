import { NextResponse } from "next/server";
import { spawn, execFileSync } from "child_process";
import { join } from "path";
import { openSync } from "fs";
import { tmpdir } from "os";
import net from "net";

const PROJECT_ROOT = join(process.cwd(), "..");
const BUILD_LOG = join(tmpdir(), "omniclaw-ios-build.log");
const TUNNEL_LOG = join(tmpdir(), "omniclaw-tunnel.log");

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
    const target = (body.target as string) || "device";

    const args = ["expo", "run:ios"];
    if (target === "device") {
      args.push("--device");
      if (udid) {
        args.push(udid);
      }
    }
    // target === "simulator" → no --device flag, runs on default simulator

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

  if (service === "tunnel") {
    // Check if cloudflared is already running
    try {
      execFileSync("pgrep", ["-f", "cloudflared tunnel"], { encoding: "utf-8" });
      return NextResponse.json({ error: "Tunnel already running" }, { status: 409 });
    } catch {
      // Not running — proceed
    }

    // Spawn named cloudflared tunnel (uses ~/.cloudflared/config.yml)
    const logFd = openSync(TUNNEL_LOG, "w");
    const child = spawn("cloudflared", ["tunnel", "run", "reef"], {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env },
    });
    child.unref();

    // Wait for tunnel to connect
    await sleep(4000);

    return NextResponse.json({
      status: "started",
      pid: child.pid,
      url: "https://omniclaw.markshteyn.com",
    });
  }

  return NextResponse.json(
    { error: `Unknown service: ${service}` },
    { status: 400 },
  );
}
