import { join } from "path";
import { writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock googleapis so we don't need real OAuth credentials
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: vi.fn(() => "https://accounts.google.com/mock"),
        getToken: vi.fn(),
        setCredentials: vi.fn(),
        revokeToken: vi.fn(),
      })),
    },
    oauth2: vi.fn(() => ({
      userinfo: {
        get: vi.fn().mockResolvedValue({ data: { email: "test@example.com" } }),
      },
    })),
  },
}));

function tempDir() {
  const dir = join(tmpdir(), `omniclaw-auth-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("auth", () => {
  let dir: string;
  let configPath: string;
  let tokensPath: string;
  let githubKeysPath: string;
  let originalEnv: string | undefined;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    dir = tempDir();
    configPath = join(dir, "config.json");
    tokensPath = join(dir, "tokens.json");
    githubKeysPath = join(dir, "github-keys.json");

    originalEnv = process.env.OMNICLAW_MCP_CONFIG;
    originalDataDir = process.env.OMNICLAW_DATA_DIR;
    process.env.OMNICLAW_MCP_CONFIG = configPath;
    process.env.OMNICLAW_DATA_DIR = dir;

    // Write base config — client_secret_path points to a dummy
    writeFileSync(
      configPath,
      JSON.stringify({
        client_secret_path: join(dir, "client_secret.json"),
        tokens_path: tokensPath,
      }),
    );
    // Write a minimal client secret so createOAuth2Client won't crash
    writeFileSync(
      join(dir, "client_secret.json"),
      JSON.stringify({ installed: { client_id: "id", client_secret: "secret" } }),
    );
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OMNICLAW_MCP_CONFIG = originalEnv;
    } else {
      delete process.env.OMNICLAW_MCP_CONFIG;
    }
    if (originalDataDir !== undefined) {
      process.env.OMNICLAW_DATA_DIR = originalDataDir;
    } else {
      delete process.env.OMNICLAW_DATA_DIR;
    }
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    vi.resetModules();
  });

  // -------------------------------------------------------------------------
  // Token CRUD (Google accounts)
  // -------------------------------------------------------------------------
  describe("setTokens / deleteTokens", () => {
    it("stores and retrieves tokens from file", async () => {
      const { setTokens } = await import("@/lib/auth");
      setTokens("work", { access_token: "at", refresh_token: "rt" });

      const raw = JSON.parse(readFileSync(tokensPath, "utf-8"));
      expect(raw.work).toBeDefined();
      expect(raw.work.access_token).toBe("at");
    });

    it("deleteTokens removes an account", async () => {
      const { setTokens, deleteTokens } = await import("@/lib/auth");
      setTokens("work", { access_token: "at" });

      const deleted = deleteTokens("work");
      expect(deleted).toBe(true);

      const raw = JSON.parse(readFileSync(tokensPath, "utf-8"));
      expect(raw).not.toHaveProperty("work");
    });

    it("deleteTokens returns false for nonexistent account", async () => {
      const { deleteTokens } = await import("@/lib/auth");
      expect(deleteTokens("nope")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // listAccounts — provider filtering
  // -------------------------------------------------------------------------
  describe("listAccounts", () => {
    it("returns Google accounts when provider is google-workspace", async () => {
      // Write a token file with one Google account
      writeFileSync(
        tokensPath,
        JSON.stringify({ default: { access_token: "at", refresh_token: "rt" } }),
      );

      const { listAccounts } = await import("@/lib/auth");
      const accounts = await listAccounts("google-workspace");

      expect(accounts.length).toBe(1);
      expect(accounts[0].provider).toBe("google");
      expect(accounts[0].name).toBe("default");
    });

    it("excludes Google accounts when provider is github", async () => {
      writeFileSync(
        tokensPath,
        JSON.stringify({ default: { access_token: "at" } }),
      );

      const { listAccounts } = await import("@/lib/auth");
      const accounts = await listAccounts("github");

      // No github key in store → no GitHub account
      expect(accounts.length).toBe(0);
    });

    it("returns GitHub account when provider is github and token is set", async () => {
      // Write a GitHub key to the key store
      writeFileSync(githubKeysPath, JSON.stringify({ default: "ghp_test" }));

      const { listAccounts } = await import("@/lib/auth");
      const accounts = await listAccounts("github");

      expect(accounts.length).toBe(1);
      expect(accounts[0].provider).toBe("github");
      expect(accounts[0].name).toBe("default");
      expect(accounts[0].isExpired).toBe(false);
    });

    it("returns all accounts when no provider filter", async () => {
      writeFileSync(
        tokensPath,
        JSON.stringify({ work: { access_token: "at", refresh_token: "rt" } }),
      );
      writeFileSync(githubKeysPath, JSON.stringify({ default: "ghp_test" }));

      const { listAccounts } = await import("@/lib/auth");
      const accounts = await listAccounts();

      const google = accounts.filter((a) => a.provider === "google");
      const github = accounts.filter((a) => a.provider === "github");
      expect(google.length).toBe(1);
      expect(github.length).toBe(1);
    });

    it("does not return GitHub account when no token configured", async () => {
      const { listAccounts } = await import("@/lib/auth");
      const accounts = await listAccounts("github");
      expect(accounts.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // GitHub token management
  // -------------------------------------------------------------------------
  describe("setGitHubToken", () => {
    it("writes token to github-keys.json", async () => {
      const { setGitHubToken } = await import("@/lib/auth");
      setGitHubToken("ghp_newtoken");

      const raw = JSON.parse(readFileSync(githubKeysPath, "utf-8"));
      expect(raw.default).toBe("ghp_newtoken");
    });
  });

  describe("revokeGitHubToken", () => {
    it("removes account from github-keys.json and returns true", async () => {
      writeFileSync(githubKeysPath, JSON.stringify({ default: "ghp_torevoke" }));

      const { revokeGitHubToken } = await import("@/lib/auth");
      const result = revokeGitHubToken("default");

      expect(result).toBe(true);
      const raw = JSON.parse(readFileSync(githubKeysPath, "utf-8"));
      expect(raw).not.toHaveProperty("default");
    });

    it("returns false when no github_token exists", async () => {
      const { revokeGitHubToken } = await import("@/lib/auth");
      expect(revokeGitHubToken("default")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // AccountInfo shape
  // -------------------------------------------------------------------------
  describe("AccountInfo provider field", () => {
    it("Google accounts have provider: google", async () => {
      writeFileSync(
        tokensPath,
        JSON.stringify({ personal: { access_token: "at" } }),
      );

      const { listAccounts } = await import("@/lib/auth");
      const accounts = await listAccounts("google-workspace");

      expect(accounts[0].provider).toBe("google");
    });

    it("GitHub account has provider: github", async () => {
      writeFileSync(githubKeysPath, JSON.stringify({ default: "ghp_xxx" }));

      const { listAccounts } = await import("@/lib/auth");
      const accounts = await listAccounts("github");

      expect(accounts[0].provider).toBe("github");
      expect(accounts[0].email).toBeNull();
    });
  });
});
