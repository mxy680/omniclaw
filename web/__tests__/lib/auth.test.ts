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
  let originalEnv: string | undefined;

  beforeEach(() => {
    dir = tempDir();
    configPath = join(dir, "config.json");
    tokensPath = join(dir, "tokens.json");

    originalEnv = process.env.OMNICLAW_MCP_CONFIG;
    process.env.OMNICLAW_MCP_CONFIG = configPath;

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

      // No github_token in config → no GitHub account either
      expect(accounts.length).toBe(0);
    });

    it("returns GitHub account when provider is github and token is set", async () => {
      // Update config to include github_token
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      config.github_token = "ghp_test";
      writeFileSync(configPath, JSON.stringify(config));

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
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      config.github_token = "ghp_test";
      writeFileSync(configPath, JSON.stringify(config));

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
    it("writes github_token to config file", async () => {
      const { setGitHubToken } = await import("@/lib/auth");
      setGitHubToken("ghp_newtoken");

      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(raw.github_token).toBe("ghp_newtoken");
    });
  });

  describe("revokeGitHubToken", () => {
    it("removes github_token from config and returns true", async () => {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      config.github_token = "ghp_torevoke";
      writeFileSync(configPath, JSON.stringify(config));

      const { revokeGitHubToken } = await import("@/lib/auth");
      const result = revokeGitHubToken();

      expect(result).toBe(true);
      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(raw).not.toHaveProperty("github_token");
    });

    it("returns false when no github_token exists", async () => {
      const { revokeGitHubToken } = await import("@/lib/auth");
      expect(revokeGitHubToken()).toBe(false);
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
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      config.github_token = "ghp_xxx";
      writeFileSync(configPath, JSON.stringify(config));

      const { listAccounts } = await import("@/lib/auth");
      const accounts = await listAccounts("github");

      expect(accounts[0].provider).toBe("github");
      expect(accounts[0].email).toBeNull();
    });
  });
});
