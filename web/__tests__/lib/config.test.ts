import { join } from "path";
import { writeFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

function tempConfigPath() {
  return join(tmpdir(), `omniclaw-test-config-${randomUUID()}.json`);
}

function writeConfig(path: string, data: Record<string, unknown>) {
  const dir = join(path, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

describe("config", () => {
  let configPath: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    configPath = tempConfigPath();
    originalEnv = process.env.OMNICLAW_MCP_CONFIG;
    process.env.OMNICLAW_MCP_CONFIG = configPath;
  });

  afterEach(async () => {
    if (originalEnv !== undefined) {
      process.env.OMNICLAW_MCP_CONFIG = originalEnv;
    } else {
      delete process.env.OMNICLAW_MCP_CONFIG;
    }
    if (existsSync(configPath)) rmSync(configPath);
    // Reset module cache so `cached` is cleared between tests
    const vi = await import("vitest");
    vi.vi.resetModules();
  });

  it("getConfig reads from OMNICLAW_MCP_CONFIG path", async () => {
    writeConfig(configPath, { client_secret_path: "/tmp/secret.json" });
    const { getConfig } = await import("@/lib/config");
    const config = getConfig();
    expect(config.client_secret_path).toBe("/tmp/secret.json");
  });

  it("getConfig throws when file is missing", async () => {
    const { getConfig } = await import("@/lib/config");
    expect(() => getConfig()).toThrow(/Config not found/);
  });

  it("getConfig reads github_token", async () => {
    writeConfig(configPath, {
      client_secret_path: "/tmp/secret.json",
      github_token: "ghp_test123",
    });
    const { getConfig } = await import("@/lib/config");
    const config = getConfig();
    expect(config.github_token).toBe("ghp_test123");
  });

  it("updateConfig merges and persists changes", async () => {
    writeConfig(configPath, { client_secret_path: "/tmp/secret.json" });
    const { getConfig, updateConfig } = await import("@/lib/config");

    // Populate cache
    getConfig();

    updateConfig({ github_token: "ghp_new" });

    // Re-read fresh from disk (bypass cache via fresh import)
    const raw = JSON.parse(
      (await import("fs")).readFileSync(configPath, "utf-8"),
    );
    expect(raw.client_secret_path).toBe("/tmp/secret.json");
    expect(raw.github_token).toBe("ghp_new");
  });

  it("updateConfig with undefined removes key from JSON", async () => {
    writeConfig(configPath, {
      client_secret_path: "/tmp/secret.json",
      github_token: "ghp_old",
    });
    const { getConfig, updateConfig } = await import("@/lib/config");
    getConfig();

    updateConfig({ github_token: undefined });

    const raw = JSON.parse(
      (await import("fs")).readFileSync(configPath, "utf-8"),
    );
    expect(raw).not.toHaveProperty("github_token");
  });

  it("getTokensPath returns default when not configured", async () => {
    writeConfig(configPath, { client_secret_path: "/tmp/secret.json" });
    const { getTokensPath } = await import("@/lib/config");
    const tokensPath = getTokensPath();
    expect(tokensPath).toContain("omniclaw-tokens.json");
  });

  it("getTokensPath returns configured value", async () => {
    writeConfig(configPath, {
      client_secret_path: "/tmp/secret.json",
      tokens_path: "/custom/tokens.json",
    });
    const { getTokensPath } = await import("@/lib/config");
    expect(getTokensPath()).toBe("/custom/tokens.json");
  });

  it("getClientSecretPath returns value from config", async () => {
    writeConfig(configPath, { client_secret_path: "/my/secret.json" });
    const { getClientSecretPath } = await import("@/lib/config");
    expect(getClientSecretPath()).toBe("/my/secret.json");
  });
});
