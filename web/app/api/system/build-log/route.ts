import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BUILD_LOG = join(tmpdir(), "omniclaw-ios-build.log");

export async function GET() {
  if (!existsSync(BUILD_LOG)) {
    return NextResponse.json({ log: "", lines: 0 });
  }

  try {
    const content = readFileSync(BUILD_LOG, "utf-8");
    const lines = content.split("\n");
    // Return last 30 lines for display
    const tail = lines.slice(-30).join("\n");
    return NextResponse.json({ log: tail, lines: lines.length });
  } catch {
    return NextResponse.json({ log: "", lines: 0 });
  }
}
