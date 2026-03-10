import { NextRequest, NextResponse } from "next/server";
import { revokeTokens, revokeGitHubToken, revokeGeminiApiKey, revokeWolframAppId, revokeLinkedinSession, revokeInstagramSession, revokeFramerCredentials } from "@/lib/auth";

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
      deleted = revokeGitHubToken(account);
    } else if (provider === "gemini") {
      deleted = revokeGeminiApiKey(account);
    } else if (provider === "wolfram-alpha") {
      deleted = revokeWolframAppId(account);
    } else if (provider === "linkedin") {
      deleted = revokeLinkedinSession(account);
    } else if (provider === "instagram") {
      deleted = revokeInstagramSession(account);
    } else if (provider === "framer") {
      deleted = revokeFramerCredentials(account);
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
