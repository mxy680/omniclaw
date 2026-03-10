import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
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

// ---------------------------------------------------------------------------
// API key store helpers (GitHub, Gemini, Wolfram)
// ---------------------------------------------------------------------------

interface ApiKeyFile {
  [account: string]: string;
}

const GITHUB_KEYS_PATH = join(homedir(), ".openclaw", "github-keys.json");
const GEMINI_KEYS_PATH = join(homedir(), ".openclaw", "gemini-keys.json");
const WOLFRAM_KEYS_PATH = join(homedir(), ".openclaw", "wolfram-keys.json");

function loadApiKeys(storePath: string): ApiKeyFile {
  if (!existsSync(storePath)) return {};
  try {
    return JSON.parse(readFileSync(storePath, "utf-8")) as ApiKeyFile;
  } catch {
    return {};
  }
}

function saveApiKeys(storePath: string, data: ApiKeyFile): void {
  const dir = dirname(storePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
}

function setApiKey(storePath: string, account: string, key: string): void {
  const data = loadApiKeys(storePath);
  data[account] = key;
  saveApiKeys(storePath, data);
}

function deleteApiKey(storePath: string, account: string): boolean {
  const data = loadApiKeys(storePath);
  if (!(account in data)) return false;
  delete data[account];
  saveApiKeys(storePath, data);
  return true;
}

function listApiKeyAccounts(storePath: string): string[] {
  return Object.keys(loadApiKeys(storePath));
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

export function setGitHubToken(token: string, account = "default"): void {
  setApiKey(GITHUB_KEYS_PATH, account, token);
}

export function revokeGitHubToken(account: string): boolean {
  return deleteApiKey(GITHUB_KEYS_PATH, account);
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

export function setGeminiApiKey(apiKey: string, account = "default"): void {
  setApiKey(GEMINI_KEYS_PATH, account, apiKey);
}

export function revokeGeminiApiKey(account: string): boolean {
  return deleteApiKey(GEMINI_KEYS_PATH, account);
}

// ---------------------------------------------------------------------------
// Wolfram
// ---------------------------------------------------------------------------

export function setWolframAppId(appId: string, account = "default"): void {
  setApiKey(WOLFRAM_KEYS_PATH, account, appId);
}

export function revokeWolframAppId(account: string): boolean {
  return deleteApiKey(WOLFRAM_KEYS_PATH, account);
}

// ---------------------------------------------------------------------------
// LinkedIn
// ---------------------------------------------------------------------------

const LINKEDIN_SESSIONS_PATH = join(homedir(), ".openclaw", "linkedin-sessions.json");

function loadLinkedinSessions(): Record<string, unknown> {
  if (!existsSync(LINKEDIN_SESSIONS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(LINKEDIN_SESSIONS_PATH, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getLinkedinAccounts(): AccountInfo[] {
  try {
    const sessions = loadLinkedinSessions();
    return Object.keys(sessions).map((name) => ({
      name,
      email: null,
      provider: "linkedin" as const,
      hasTokens: true,
      isExpired: false,
    }));
  } catch {
    return [];
  }
}

export function revokeLinkedinSession(account: string): boolean {
  try {
    const sessions = loadLinkedinSessions();
    if (!(account in sessions)) return false;
    delete sessions[account];
    writeFileSync(LINKEDIN_SESSIONS_PATH, JSON.stringify(sessions, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------------------

const INSTAGRAM_SESSIONS_PATH = join(homedir(), ".openclaw", "instagram-sessions.json");

function loadInstagramSessions(): Record<string, unknown> {
  if (!existsSync(INSTAGRAM_SESSIONS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(INSTAGRAM_SESSIONS_PATH, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getInstagramAccounts(): AccountInfo[] {
  try {
    const sessions = loadInstagramSessions();
    return Object.keys(sessions).map((name) => ({
      name,
      email: null,
      provider: "instagram" as const,
      hasTokens: true,
      isExpired: false,
    }));
  } catch {
    return [];
  }
}

export function revokeInstagramSession(account: string): boolean {
  try {
    const sessions = loadInstagramSessions();
    if (!(account in sessions)) return false;
    delete sessions[account];
    writeFileSync(INSTAGRAM_SESSIONS_PATH, JSON.stringify(sessions, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Framer
// ---------------------------------------------------------------------------

const FRAMER_KEYS_PATH = join(homedir(), ".openclaw", "framer-keys.json");

export function setFramerCredentials(credentials: string, account = "default"): void {
  setApiKey(FRAMER_KEYS_PATH, account, credentials);
}

export function revokeFramerCredentials(account: string): boolean {
  return deleteApiKey(FRAMER_KEYS_PATH, account);
}

// ---------------------------------------------------------------------------
// Account listing
// ---------------------------------------------------------------------------

export interface AccountInfo {
  name: string;
  email: string | null;
  provider: "google" | "github" | "gemini" | "wolfram" | "linkedin" | "instagram" | "framer";
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
    const names = listApiKeyAccounts(GITHUB_KEYS_PATH);
    if (names.length > 0) {
      for (const name of names) {
        accounts.push({ name, email: null, provider: "github", hasTokens: true, isExpired: false });
      }
    } else {
      // Fallback: check legacy config for pre-migration display
      try {
        const config = getConfig();
        if (config.github_token) {
          accounts.push({ name: "default", email: null, provider: "github", hasTokens: true, isExpired: false });
        }
      } catch { /* no config */ }
    }
  }

  if (!provider || provider === "gemini") {
    const names = listApiKeyAccounts(GEMINI_KEYS_PATH);
    if (names.length > 0) {
      for (const name of names) {
        accounts.push({ name, email: null, provider: "gemini", hasTokens: true, isExpired: false });
      }
    } else {
      try {
        const config = getConfig();
        if (config.gemini_api_key) {
          accounts.push({ name: "default", email: null, provider: "gemini", hasTokens: true, isExpired: false });
        }
      } catch { /* no config */ }
    }
  }

  if (!provider || provider === "wolfram-alpha") {
    const names = listApiKeyAccounts(WOLFRAM_KEYS_PATH);
    if (names.length > 0) {
      for (const name of names) {
        accounts.push({ name, email: null, provider: "wolfram", hasTokens: true, isExpired: false });
      }
    } else {
      try {
        const config = getConfig();
        if (config.wolfram_appid) {
          accounts.push({ name: "default", email: null, provider: "wolfram", hasTokens: true, isExpired: false });
        }
      } catch { /* no config */ }
    }
  }

  if (!provider || provider === "linkedin") {
    const linkedinAccounts = getLinkedinAccounts();
    accounts.push(...linkedinAccounts);
  }

  if (!provider || provider === "instagram") {
    const instagramAccounts = getInstagramAccounts();
    accounts.push(...instagramAccounts);
  }

  if (!provider || provider === "framer") {
    const names = listApiKeyAccounts(FRAMER_KEYS_PATH);
    for (const name of names) {
      accounts.push({ name, email: null, provider: "framer", hasTokens: true, isExpired: false });
    }
  }

  return accounts;
}

// ---------------------------------------------------------------------------
// Google token revocation
// ---------------------------------------------------------------------------

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
