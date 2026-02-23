import { randomUUID } from "crypto";
import { existsSync, rmSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LinkedInClientManager } from "../src/auth/linkedin-client-manager.js";
import type { LinkedInSession } from "../src/auth/linkedin-client-manager.js";

function tempPath() {
  return join(tmpdir(), `omniclaw-test-linkedin-${randomUUID()}.json`);
}

function makeSession(overrides?: Partial<LinkedInSession>): LinkedInSession {
  return {
    li_at: "test-li-at-token",
    jsessionid: '"ajax:1234567890"',
    csrf_token: "ajax:1234567890",
    all_cookies: { li_at: "test-li-at-token", JSESSIONID: '"ajax:1234567890"' },
    cookie_details: [
      { name: "li_at", value: "test-li-at-token", domain: ".linkedin.com", path: "/" },
      { name: "JSESSIONID", value: '"ajax:1234567890"', domain: ".linkedin.com", path: "/" },
    ],
    ...overrides,
  };
}

describe("LinkedInClientManager", () => {
  let tokensPath: string;
  beforeEach(() => {
    tokensPath = tempPath();
  });
  afterEach(() => {
    if (existsSync(tokensPath)) rmSync(tokensPath);
  });

  it("returns null for a missing account", () => {
    const manager = new LinkedInClientManager(tokensPath);
    expect(manager.getCredentials("default")).toBeNull();
  });

  it("hasCredentials returns false when no session exists", () => {
    const manager = new LinkedInClientManager(tokensPath);
    expect(manager.hasCredentials("default")).toBe(false);
  });

  it("stores and retrieves session credentials", () => {
    const manager = new LinkedInClientManager(tokensPath);
    const session = makeSession();
    manager.setCredentials("default", session);

    const retrieved = manager.getCredentials("default");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.li_at).toBe("test-li-at-token");
    expect(retrieved!.csrf_token).toBe("ajax:1234567890");
    expect(retrieved!.all_cookies.li_at).toBe("test-li-at-token");
  });

  it("hasCredentials returns true after setting credentials", () => {
    const manager = new LinkedInClientManager(tokensPath);
    manager.setCredentials("default", makeSession());
    expect(manager.hasCredentials("default")).toBe(true);
  });

  it("hasCredentials returns false for empty li_at", () => {
    const manager = new LinkedInClientManager(tokensPath);
    manager.setCredentials("default", makeSession({ li_at: "" }));
    expect(manager.hasCredentials("default")).toBe(false);
  });

  it("persists tokens across separate instances", () => {
    const manager1 = new LinkedInClientManager(tokensPath);
    manager1.setCredentials("default", makeSession());

    const manager2 = new LinkedInClientManager(tokensPath);
    const session = manager2.getCredentials("default");
    expect(session).not.toBeNull();
    expect(session!.li_at).toBe("test-li-at-token");
  });

  it("supports multiple accounts", () => {
    const manager = new LinkedInClientManager(tokensPath);
    manager.setCredentials("work", makeSession({ li_at: "work-token" }));
    manager.setCredentials("personal", makeSession({ li_at: "personal-token" }));

    expect(manager.getCredentials("work")!.li_at).toBe("work-token");
    expect(manager.getCredentials("personal")!.li_at).toBe("personal-token");
    expect(manager.listAccounts()).toEqual(expect.arrayContaining(["work", "personal"]));
  });

  it("listAccounts returns empty array for fresh file", () => {
    const manager = new LinkedInClientManager(tokensPath);
    expect(manager.listAccounts()).toEqual([]);
  });

  it("handles corrupt JSON gracefully", () => {
    const { writeFileSync } = require("fs");
    writeFileSync(tokensPath, "not valid json", "utf-8");
    const manager = new LinkedInClientManager(tokensPath);
    expect(manager.getCredentials("default")).toBeNull();
    expect(manager.listAccounts()).toEqual([]);
  });

  it("extractEntities filters by $type suffix", () => {
    const manager = new LinkedInClientManager(tokensPath);
    const data = {
      included: [
        { $type: "com.linkedin.voyager.identity.shared.MiniProfile", firstName: "John" },
        { $type: "com.linkedin.voyager.feed.Update", text: "hello" },
        { $type: "com.linkedin.voyager.identity.shared.MiniProfile", firstName: "Jane" },
      ],
    };
    const profiles = manager.extractEntities(data, "MiniProfile");
    expect(profiles).toHaveLength(2);
    expect(profiles[0].firstName).toBe("John");
    expect(profiles[1].firstName).toBe("Jane");
  });

  it("extractEntities returns empty for missing included", () => {
    const manager = new LinkedInClientManager(tokensPath);
    expect(manager.extractEntities({}, "MiniProfile")).toEqual([]);
    expect(manager.extractEntities({ included: undefined }, "MiniProfile")).toEqual([]);
  });
});
