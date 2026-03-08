import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { homedir } from "os";
import { SessionStore } from "../../../../src/auth/session-store";
import { authenticateLinkedin } from "../../../../src/auth/linkedin-browser-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const account = (body.account as string)?.trim() || "default";

    const sessionsPath = join(homedir(), ".openclaw", "linkedin-sessions.json");
    const sessionStore = new SessionStore(sessionsPath);

    await authenticateLinkedin(sessionStore, account);

    return NextResponse.json({ success: true, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
