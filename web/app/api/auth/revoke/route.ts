import { NextRequest, NextResponse } from "next/server";
import { revokeTokens, revokeGitHubToken, revokeGeminiApiKey, revokeWolframAppId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const account = body.account;
    const provider = body.provider;

    if (!account || typeof account !== "string") {
      return NextResponse.json(
        { error: "account is required" },
        { status: 400 },
      );
    }

    let deleted: boolean;
    if (provider === "github") {
      deleted = revokeGitHubToken();
    } else if (provider === "gemini") {
      deleted = revokeGeminiApiKey();
    } else if (provider === "wolfram-alpha") {
      deleted = revokeWolframAppId();
    } else {
      deleted = await revokeTokens(account);
    }

    if (!deleted) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
