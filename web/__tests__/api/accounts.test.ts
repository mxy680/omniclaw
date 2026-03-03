import { join } from "path";
import { writeFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock googleapis
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
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
  const dir = join(tmpdir(), `omniclaw-api-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("GET /api/auth/accounts", () => {
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

    writeFileSync(
      configPath,
      JSON.stringify({
        client_secret_path: join(dir, "client_secret.json"),
        tokens_path: tokensPath,
      }),
    );
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

  it("returns only Google accounts for provider=google-workspace", async () => {
    writeFileSync(
      tokensPath,
      JSON.stringify({ work: { access_token: "at", refresh_token: "rt" } }),
    );
    // Add a GitHub token to config
    const cfg = JSON.parse(
      (await import("fs")).readFileSync(configPath, "utf-8"),
    );
    cfg.github_token = "ghp_test";
    writeFileSync(configPath, JSON.stringify(cfg));

    const { GET } = await import("@/app/api/auth/accounts/route");
    const req = new NextRequest("http://localhost/api/auth/accounts?provider=google-workspace");
    const res = await GET(req);
    const body = await res.json();

    expect(body.accounts.length).toBe(1);
    expect(body.accounts[0].provider).toBe("google");
  });

  it("returns only GitHub account for provider=github", async () => {
    // Add Google tokens (should be excluded)
    writeFileSync(
      tokensPath,
      JSON.stringify({ work: { access_token: "at" } }),
    );
    // Add GitHub token
    const cfg = JSON.parse(
      (await import("fs")).readFileSync(configPath, "utf-8"),
    );
    cfg.github_token = "ghp_test";
    writeFileSync(configPath, JSON.stringify(cfg));

    const { GET } = await import("@/app/api/auth/accounts/route");
    const req = new NextRequest("http://localhost/api/auth/accounts?provider=github");
    const res = await GET(req);
    const body = await res.json();

    expect(body.accounts.length).toBe(1);
    expect(body.accounts[0].provider).toBe("github");
    expect(body.accounts[0].name).toBe("default");
  });

  it("returns empty for provider=github when no token set", async () => {
    const { GET } = await import("@/app/api/auth/accounts/route");
    const req = new NextRequest("http://localhost/api/auth/accounts?provider=github");
    const res = await GET(req);
    const body = await res.json();

    expect(body.accounts).toEqual([]);
  });

  it("returns all accounts when no provider param", async () => {
    writeFileSync(
      tokensPath,
      JSON.stringify({ default: { access_token: "at", refresh_token: "rt" } }),
    );
    const cfg = JSON.parse(
      (await import("fs")).readFileSync(configPath, "utf-8"),
    );
    cfg.github_token = "ghp_test";
    writeFileSync(configPath, JSON.stringify(cfg));

    const { GET } = await import("@/app/api/auth/accounts/route");
    const req = new NextRequest("http://localhost/api/auth/accounts");
    const res = await GET(req);
    const body = await res.json();

    expect(body.accounts.length).toBe(2);
    const providers = body.accounts.map((a: { provider: string }) => a.provider);
    expect(providers).toContain("google");
    expect(providers).toContain("github");
  });
});
