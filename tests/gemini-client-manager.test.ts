import { existsSync, unlinkSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiClientManager } from "../src/auth/gemini-client-manager.js";

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(public opts: { apiKey: string }) {}
  },
}));

describe("GeminiClientManager", () => {
  let tempPath: string;
  let manager: GeminiClientManager;

  beforeEach(() => {
    const dir = join(tmpdir(), "omniclaw-test-" + Date.now());
    mkdirSync(dir, { recursive: true });
    tempPath = join(dir, "gemini-keys.json");
    manager = new GeminiClientManager(tempPath);
  });

  afterEach(() => {
    if (existsSync(tempPath)) {
      unlinkSync(tempPath);
    }
  });

  it("returns null for unknown account", () => {
    expect(manager.getKey("nonexistent")).toBeNull();
  });

  it("hasKey returns false for unknown account", () => {
    expect(manager.hasKey("nonexistent")).toBe(false);
  });

  it("stores and retrieves a key", () => {
    manager.setKey("default", "test-api-key-123");
    expect(manager.getKey("default")).toBe("test-api-key-123");
    expect(manager.hasKey("default")).toBe(true);
  });

  it("lists accounts", () => {
    manager.setKey("work", "key-work");
    manager.setKey("personal", "key-personal");
    expect(manager.listAccounts()).toEqual(["work", "personal"]);
  });

  it("overwrites existing key for same account", () => {
    manager.setKey("default", "old-key");
    manager.setKey("default", "new-key");
    expect(manager.getKey("default")).toBe("new-key");
  });

  it("persists keys across instances", () => {
    manager.setKey("default", "persistent-key");
    const manager2 = new GeminiClientManager(tempPath);
    expect(manager2.getKey("default")).toBe("persistent-key");
  });

  it("getClient returns a GoogleGenAI instance", () => {
    manager.setKey("default", "test-key");
    const client = manager.getClient("default");
    expect((client as any).opts.apiKey).toBe("test-key");
  });

  it("getClient returns cached instance on second call", () => {
    manager.setKey("default", "test-key");
    const client1 = manager.getClient("default");
    const client2 = manager.getClient("default");
    expect(client1).toBe(client2);
  });

  it("getClient clears cache when key is updated", () => {
    manager.setKey("default", "key-1");
    const client1 = manager.getClient("default");
    manager.setKey("default", "key-2");
    const client2 = manager.getClient("default");
    expect(client1).not.toBe(client2);
    expect((client2 as any).opts.apiKey).toBe("key-2");
  });

  it("getClient throws for unknown account", () => {
    expect(() => manager.getClient("unknown")).toThrow(
      "No Gemini API key for account: unknown. Call gemini_auth_setup first.",
    );
  });
});
