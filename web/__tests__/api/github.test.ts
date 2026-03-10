import { join } from "path";
import { writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock googleapis (auth.ts imports it)
vi.mock("googleapis", () => ({
  google: {
    auth: { OAuth2: vi.fn().mockImplementation(() => ({})) },
    oauth2: vi.fn(() => ({ userinfo: { get: vi.fn() } })),
  },
}));

function tempDir() {
  const dir = join(tmpdir(), `omniclaw-gh-api-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("POST /api/auth/github", () => {
  let dir: string;
  let configPath: string;
  let githubKeysPath: string;
  let originalEnv: string | undefined;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    dir = tempDir();
    configPath = join(dir, "config.json");
    githubKeysPath = join(dir, "github-keys.json");

    originalEnv = process.env.OMNICLAW_MCP_CONFIG;
    originalDataDir = process.env.OMNICLAW_DATA_DIR;
    process.env.OMNICLAW_MCP_CONFIG = configPath;
    process.env.OMNICLAW_DATA_DIR = dir;

    writeFileSync(
      configPath,
      JSON.stringify({ client_secret_path: join(dir, "secret.json") }),
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

  it("saves the token to key store and returns success", async () => {
    const { POST } = await import("@/app/api/auth/github/route");
    const req = new NextRequest("http://localhost/api/auth/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "ghp_newtoken" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Verify it was persisted to github-keys.json
    const raw = JSON.parse(readFileSync(githubKeysPath, "utf-8"));
    expect(raw.default).toBe("ghp_newtoken");
  });

  it("returns 400 when token is missing", async () => {
    const { POST } = await import("@/app/api/auth/github/route");
    const req = new NextRequest("http://localhost/api/auth/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is not a string", async () => {
    const { POST } = await import("@/app/api/auth/github/route");
    const req = new NextRequest("http://localhost/api/auth/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: 12345 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
