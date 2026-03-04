import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";
import net from "net";

const PROJECT_ROOT = join(process.cwd(), "..");

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "localhost" });
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

    const child = spawn("npx", args, {
      cwd: mobileDir,
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    child.unref();

    return NextResponse.json({
      status: "building",
      pid: child.pid,
    });
  }

  return NextResponse.json(
    { error: `Unknown service: ${service}` },
    { status: 400 },
  );
}
