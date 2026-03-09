import { NextResponse } from "next/server";
import { getToolRegistry } from "@/lib/tools";

// Force dynamic — never cache this route
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const registry = await getToolRegistry();
    return NextResponse.json({ services: registry.services });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load tools";
    console.error("[/api/tools] Failed to load tool registry:", message);
    if (err instanceof Error && err.stack) console.error(err.stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
