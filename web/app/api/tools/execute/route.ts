import { NextResponse } from "next/server";
import { getToolRegistry } from "@/lib/tools";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tool, params = {} } = body as {
      tool: string;
      params?: Record<string, unknown>;
    };

    if (!tool) {
      return NextResponse.json({ error: "Missing 'tool' field" }, { status: 400 });
    }

    const registry = await getToolRegistry();
    const start = Date.now();

    try {
      const result = await registry.execute(tool, params);
      return NextResponse.json({
        success: true,
        result,
        duration: Date.now() - start,
      });
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to execute tool";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
