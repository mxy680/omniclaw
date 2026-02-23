/**
 * Standalone re-auth script. Run with:
 *   npx tsx scripts/reauth.ts
 *
 * Opens a browser for the Google sign-in flow and writes a fresh
 * gmail.modify token to ~/.openclaw/omniclaw-tokens.json.
 */

import * as path from "path";
import * as os from "os";
import { createOAuthClient } from "../src/auth/gmail-auth";
import { waitForOAuthCallback } from "../src/auth/oauth-server";
import { TokenStore } from "../src/auth/token-store";

const CLIENT_SECRET_PATH =
  process.env.CLIENT_SECRET_PATH ??
  "/Users/markshteyn/Downloads/client_secret_772791512967-bb4nvpsu9umlr74nt12cjvloaq6hcale.apps.googleusercontent.com.json";

const TOKENS_PATH =
  process.env.TOKENS_PATH ??
  path.join(os.homedir(), ".openclaw", "omniclaw-tokens.json");

const PORT = 9753;
const ACCOUNT = process.env.GMAIL_ACCOUNT ?? "default";

async function main() {
  console.log("Creating OAuth client...");
  const client = createOAuthClient(CLIENT_SECRET_PATH, PORT);
  const tokenStore = new TokenStore(TOKENS_PATH);

  console.log("Opening browser for Google sign-in (gmail.modify scope)...");
  const open = (await import("open")).default;

  const tokens = await waitForOAuthCallback(client, PORT, (url) => {
    console.log("\nIf the browser does not open, visit:\n", url, "\n");
    open(url).catch(() => {});
  });

  tokenStore.set(ACCOUNT, tokens);
  console.log(`\nAuthenticated. Token saved to ${TOKENS_PATH} (account: "${ACCOUNT}")`);
}

main().catch((err) => {
  console.error("Auth failed:", err.message);
  process.exit(1);
});
