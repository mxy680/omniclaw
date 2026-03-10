import { join } from "path";
import { writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "fs";
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
        revokeToken: vi.fn(),
      })),
    },
    oauth2: vi.fn(() => ({ userinfo: { get: vi.fn() } })),
  },
}));

function tempDir() {
  const dir = join(tmpdir(), `omniclaw-revoke-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("POST /api/auth/revoke", () => {
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

    writeFileSync(
      configPath,
      JSON.stringify({
        client_secret_path: join(dir, "secret.json"),
        tokens_path: tokensPath,
      }),
    );
    writeFileSync(
      join(dir, "secret.json"),
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

  it("revokes a Google account (removes from token file)", async () => {
    writeFileSync(
      tokensPath,
      JSON.stringify({ work: { access_token: "at", refresh_token: "rt" } }),
    );

    const { POST } = await import("@/app/api/auth/revoke/route");
    const req = new NextRequest("http://localhost/api/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: "work", provider: "google-workspace" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const raw = JSON.parse(readFileSync(tokensPath, "utf-8"));
    expect(raw).not.toHaveProperty("work");
  });

  it("revokes GitHub token (removes from key store)", async () => {
    writeFileSync(githubKeysPath, JSON.stringify({ default: "ghp_torevoke" }));

    const { POST } = await import("@/app/api/auth/revoke/route");
    const req = new NextRequest("http://localhost/api/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: "default", provider: "github" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const raw = JSON.parse(readFileSync(githubKeysPath, "utf-8"));
    expect(raw).not.toHaveProperty("default");
  });

  it("returns 404 when Google account not found", async () => {
    const { POST } = await import("@/app/api/auth/revoke/route");
    const req = new NextRequest("http://localhost/api/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: "nonexistent" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 404 when GitHub token not set", async () => {
    const { POST } = await import("@/app/api/auth/revoke/route");
    const req = new NextRequest("http://localhost/api/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: "default", provider: "github" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when account param is missing", async () => {
    const { POST } = await import("@/app/api/auth/revoke/route");
    const req = new NextRequest("http://localhost/api/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
