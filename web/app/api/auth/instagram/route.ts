import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const account = (body.account as string)?.trim() || "default";

    // Spawn the standalone auth script which uses Playwright.
    // The web app runs from <root>/web, so go up one level to reach the project root.
    const projectRoot = join(process.cwd(), "..");
    const scriptPath = join(projectRoot, "scripts", "instagram-auth.mjs");

    const result = await new Promise<string>((resolve, reject) => {
      execFile("node", [scriptPath, account], {
        timeout: 130_000,
        cwd: projectRoot,
        env: { ...process.env, NODE_PATH: join(projectRoot, "node_modules") },
      }, (err, stdout, stderr) => {
        if (err) {
          try {
            const parsed = JSON.parse(stderr);
            reject(new Error(parsed.error ?? "Authentication failed"));
          } catch {
            reject(new Error(stderr || err.message));
          }
          return;
        }
        resolve(stdout);
      });
    });

    const parsed = JSON.parse(result);
    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
