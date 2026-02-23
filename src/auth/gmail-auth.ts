import { google } from "googleapis";
import { readFileSync } from "fs";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export function createOAuthClient(clientSecretPath: string, redirectPort: number): OAuth2Client {
  const secret = JSON.parse(readFileSync(clientSecretPath, "utf-8"));
  const { client_id, client_secret } = secret.installed ?? secret.web;
  const redirectUri = `http://localhost:${redirectPort}/oauth/callback`;
  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

export function getAuthUrl(client: OAuth2Client): string {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    prompt: "consent",
  });
}
