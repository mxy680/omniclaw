import { NextRequest, NextResponse } from "next/server";
import { setGeminiApiKey } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = body.api_key;
    const account = body.account ?? "default";

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "api_key is required" },
        { status: 400 },
      );
    }

    setGeminiApiKey(apiKey, account);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
