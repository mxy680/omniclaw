import { NextRequest, NextResponse } from "next/server";
import { setFramerCredentials } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_url, api_key, account = "default" } = body;

    if (!project_url || !api_key) {
      return NextResponse.json(
        { error: "project_url and api_key are required" },
        { status: 400 },
      );
    }

    const credentials = JSON.stringify({ url: project_url, apiKey: api_key });
    setFramerCredentials(credentials, account);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
