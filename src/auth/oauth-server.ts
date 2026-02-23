import * as http from "http";
import { URL } from "url";
import { google } from "googleapis";
import { getAuthUrl } from "./gmail-auth";
import type { Credentials } from "google-auth-library";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>omniclaw — Authenticated</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px">
  <h1>✅ Gmail authenticated successfully!</h1>
  <p>You can close this tab and return to OpenClaw.</p>
</body>
</html>`;

const ERROR_HTML = (msg: string) => `<!DOCTYPE html>
<html>
<head><title>omniclaw — Error</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px">
  <h1>❌ Authentication failed</h1>
  <p>${msg}</p>
</body>
</html>`;

export async function waitForOAuthCallback(
  client: OAuth2Client,
  port: number,
  onUrl: (url: string) => void
): Promise<Credentials> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith("/oauth/callback")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const parsed = new URL(req.url, `http://localhost:${port}`);
      const code = parsed.searchParams.get("code");
      const error = parsed.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_HTML(error));
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(ERROR_HTML("No authorization code received."));
        server.close();
        reject(new Error("No authorization code in callback"));
        return;
      }

      try {
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(SUCCESS_HTML);
        server.close();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(ERROR_HTML("Token exchange failed."));
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {
      const url = getAuthUrl(client);
      onUrl(url);
    });

    server.on("error", (err) => {
      reject(new Error(`OAuth server failed to start: ${err.message}`));
    });
  });
}
