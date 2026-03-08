import { NextRequest, NextResponse } from "next/server";
import { setWolframAppId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const appId = body.app_id;

    if (!appId || typeof appId !== "string") {
      return NextResponse.json(
        { error: "app_id is required" },
        { status: 400 },
      );
    }

    setWolframAppId(appId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
