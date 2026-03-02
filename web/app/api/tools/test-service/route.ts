import { NextResponse } from "next/server";
import { getToolRegistry } from "@/lib/tools";
import { runServiceTest } from "@/lib/test-plans";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { service } = body as { service: string };

    if (!service) {
      return NextResponse.json({ error: "Missing 'service' field" }, { status: 400 });
    }

    const registry = await getToolRegistry();
    const result = await runServiceTest(service, registry.execute);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run test";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
