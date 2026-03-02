import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await listAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
