import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { HcmClientManager } from "../../src/auth/hcm-client-manager.js";

describe("HcmClientManager", () => {
  let tokensPath: string;
  let manager: HcmClientManager;

  beforeEach(() => {
    const dir = join(tmpdir(), "hcm-test-" + Date.now());
    mkdirSync(dir, { recursive: true });
    tokensPath = join(dir, "tokens.json");
    manager = new HcmClientManager(tokensPath);
  });

  afterEach(() => {
    if (existsSync(tokensPath)) unlinkSync(tokensPath);
  });

  it("returns null for unknown account", () => {
    expect(manager.getCredentials("default")).toBeNull();
    expect(manager.hasCredentials("default")).toBe(false);
  });

  it("stores and retrieves session", () => {
    const session = {
      cookies: { PS_TOKEN: "abc123" },
      cookie_details: [{ name: "PS_TOKEN", value: "abc123", domain: "hcm.case.edu", path: "/" }],
      employee_name: "Test User",
    };
    manager.setCredentials("default", session);
    expect(manager.hasCredentials("default")).toBe(true);
    expect(manager.getCredentials("default")).toEqual(session);
  });

  it("lists accounts", () => {
    manager.setCredentials("work", {
      cookies: { PS_TOKEN: "x" },
      cookie_details: [],
      employee_name: "User",
    });
    expect(manager.listAccounts()).toEqual(["work"]);
  });
});
