import { NextResponse } from "next/server";
import { execFileSync } from "child_process";

function findPidOnPort(port: number): number | null {
  try {
    const output = execFileSync("lsof", ["-ti", `:${port}`], { encoding: "utf-8" }).trim();
    if (output) {
      const pid = parseInt(output.split("\n")[0], 10);
      return isNaN(pid) ? null : pid;
    }
  } catch {
    // lsof exits non-zero when no process found
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const service = body.service as string;

  let port: number;
  if (service === "gateway") {
    port = 18789;
  } else if (service === "mcp-server") {
    port = 9850;
  } else {
    return NextResponse.json(
      { error: `Unknown service: ${service}` },
      { status: 400 },
    );
  }

  const pid = findPidOnPort(port);
  if (!pid) {
    return NextResponse.json({ error: `No process found on port ${port}` }, { status: 404 });
  }

  try {
    process.kill(pid, "SIGTERM");
    return NextResponse.json({ status: "stopped", pid });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
