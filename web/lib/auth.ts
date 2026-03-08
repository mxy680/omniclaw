import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import { getClientSecretPath, getTokensPath, getConfig, updateConfig } from "./config";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/userinfo.email",
];

const REDIRECT_URI = "http://localhost:3100/api/auth/callback";

interface TokenFile {
  [account: string]: Credentials;
}

export function createOAuth2Client(): OAuth2Client {
  const secretPath = getClientSecretPath();
  const secret = JSON.parse(readFileSync(secretPath, "utf-8"));
  const { client_id, client_secret } = secret.installed ?? secret.web;
  return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

export function generateAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function exchangeCode(code: string): Promise<Credentials> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getEmailForTokens(tokens: Credentials): Promise<string | null> {
  try {
    const client = createOAuth2Client();
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();
    return data.email ?? null;
  } catch {
    return null;
  }
}

function loadTokens(): TokenFile {
  const tokensPath = getTokensPath();
  if (!existsSync(tokensPath)) return {};
  try {
    return JSON.parse(readFileSync(tokensPath, "utf-8")) as TokenFile;
  } catch {
    return {};
  }
}

function saveTokens(data: TokenFile): void {
  const tokensPath = getTokensPath();
  const dir = dirname(tokensPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(tokensPath, JSON.stringify(data, null, 2), "utf-8");
}

export function setTokens(account: string, tokens: Credentials): void {
  const data = loadTokens();
  data[account] = tokens;
  saveTokens(data);
}

export function deleteTokens(account: string): boolean {
  const data = loadTokens();
  if (!(account in data)) return false;
  delete data[account];
  saveTokens(data);
  return true;
}

export interface AccountInfo {
  name: string;
  email: string | null;
  provider: "google" | "github" | "gemini";
  hasTokens: boolean;
  isExpired: boolean;
}

export async function listAccounts(provider?: string): Promise<AccountInfo[]> {
  const accounts: AccountInfo[] = [];

  if (!provider || provider === "google-workspace") {
    const data = loadTokens();
    for (const [name, tokens] of Object.entries(data)) {
      const email = await getEmailForTokens(tokens);
      const isExpired = tokens.expiry_date
        ? Date.now() > tokens.expiry_date
        : false;
      accounts.push({
        name,
        email,
        provider: "google",
        hasTokens: true,
        isExpired: !tokens.refresh_token && isExpired,
      });
    }
  }

  if (!provider || provider === "github") {
    const ghAccount = getGitHubAccount();
    if (ghAccount) accounts.push(ghAccount);
  }

  if (!provider || provider === "gemini") {
    const geminiAccount = getGeminiAccount();
    if (geminiAccount) accounts.push(geminiAccount);
  }

  return accounts;
}

function getGitHubAccount(): AccountInfo | null {
  try {
    const config = getConfig();
    if (!config.github_token) return null;
    return {
      name: "default",
      email: null,
      provider: "github",
      hasTokens: true,
      isExpired: false,
    };
  } catch {
    return null;
  }
}

function getGeminiAccount(): AccountInfo | null {
  try {
    const config = getConfig();
    if (!config.gemini_api_key) return null;
    return {
      name: "default",
      email: null,
      provider: "gemini",
      hasTokens: true,
      isExpired: false,
    };
  } catch {
    return null;
  }
}

export function setGeminiApiKey(apiKey: string): void {
  updateConfig({ gemini_api_key: apiKey });
}

export function revokeGeminiApiKey(): boolean {
  try {
    const config = getConfig();
    if (!config.gemini_api_key) return false;
    updateConfig({ gemini_api_key: undefined });
    return true;
  } catch {
    return false;
  }
}

export function setGitHubToken(token: string): void {
  updateConfig({ github_token: token });
}

export function revokeGitHubToken(): boolean {
  try {
    const config = getConfig();
    if (!config.github_token) return false;
    updateConfig({ github_token: undefined });
    return true;
  } catch {
    return false;
  }
}

export async function revokeTokens(account: string): Promise<boolean> {
  const data = loadTokens();
  const tokens = data[account];
  if (!tokens) return false;

  // Try to revoke with Google
  if (tokens.access_token) {
    try {
      const client = createOAuth2Client();
      client.setCredentials(tokens);
      await client.revokeToken(tokens.access_token);
    } catch {
      // Revocation is best-effort; still remove locally
    }
  }

  return deleteTokens(account);
}
