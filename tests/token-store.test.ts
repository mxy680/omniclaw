import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { TokenStore } from "../src/auth/token-store";

function tempPath() {
  return join(tmpdir(), `omniclaw-test-${randomUUID()}.json`);
}

describe("TokenStore", () => {
  let path: string;

  beforeEach(() => {
    path = tempPath();
  });

  afterEach(() => {
    if (existsSync(path)) rmSync(path);
  });

  it("returns null for a missing account", () => {
    const store = new TokenStore(path);
    expect(store.get("default")).toBeNull();
  });

  it("has() returns false when account does not exist", () => {
    const store = new TokenStore(path);
    expect(store.has("default")).toBe(false);
  });

  it("stores and retrieves tokens", () => {
    const store = new TokenStore(path);
    const tokens = { access_token: "abc123", refresh_token: "refresh456" };
    store.set("default", tokens);
    expect(store.get("default")).toEqual(tokens);
  });

  it("has() returns true after set()", () => {
    const store = new TokenStore(path);
    store.set("work", { access_token: "work-token" });
    expect(store.has("work")).toBe(true);
  });

  it("persists tokens across separate instances", () => {
    new TokenStore(path).set("personal", { access_token: "personal-token" });
    const store2 = new TokenStore(path);
    expect(store2.get("personal")).toMatchObject({ access_token: "personal-token" });
  });

  it("returns null gracefully when file contains invalid JSON", () => {
    writeFileSync(path, "not valid json", "utf-8");
    const store = new TokenStore(path);
    expect(store.get("default")).toBeNull();
  });

  it("list() returns empty array when no accounts exist", () => {
    const store = new TokenStore(path);
    expect(store.list()).toEqual([]);
  });

  it("list() returns account names after set()", () => {
    const store = new TokenStore(path);
    store.set("work", { access_token: "w" });
    store.set("personal", { access_token: "p" });
    expect(store.list()).toEqual(expect.arrayContaining(["work", "personal"]));
    expect(store.list()).toHaveLength(2);
  });

  it("list() returns empty array for invalid JSON file", () => {
    writeFileSync(path, "not valid json", "utf-8");
    const store = new TokenStore(path);
    expect(store.list()).toEqual([]);
  });
});
