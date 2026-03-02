import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, setTokens, getEmailForTokens } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?error=No+authorization+code+received", request.url),
    );
  }

  const account = request.cookies.get("omniclaw_account")?.value ?? "default";

  try {
    const tokens = await exchangeCode(code);
    setTokens(account, tokens);

    const email = await getEmailForTokens(tokens);
    const params = new URLSearchParams({ success: "true", account });
    if (email) params.set("email", email);

    const response = NextResponse.redirect(
      new URL(`/?${params.toString()}`, request.url),
    );
    response.cookies.delete("omniclaw_account");
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
