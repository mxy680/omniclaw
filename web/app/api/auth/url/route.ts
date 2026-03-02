import { NextRequest, NextResponse } from "next/server";
import { generateAuthUrl } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const account = request.nextUrl.searchParams.get("account");
  if (!account) {
    return NextResponse.json(
      { error: "account parameter is required" },
      { status: 400 },
    );
  }

  try {
    const url = generateAuthUrl();
    const response = NextResponse.json({ url });
    response.cookies.set("omniclaw_account", account, {
      httpOnly: true,
      maxAge: 600, // 10 minutes
      path: "/",
      sameSite: "lax",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
