import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGeminiAuthTool } from "../src/tools/gemini-auth-tool.js";

const mocks = vi.hoisted(() => ({
  modelsList: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { list: mocks.modelsList };
  },
}));

function makeManager() {
  const keys = new Map<string, string>();
  return {
    setKey: vi.fn((account: string, key: string) => keys.set(account, key)),
    getKey: vi.fn((account: string) => keys.get(account) ?? null),
    hasKey: vi.fn((account: string) => keys.has(account)),
    listAccounts: vi.fn(() => Array.from(keys.keys())),
    getClient: vi.fn(),
  };
}

describe("createGeminiAuthTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when no key provided and config empty", async () => {
    const manager = makeManager();
    const tool = createGeminiAuthTool(manager as any, {} as any);

    const result = await tool.execute("c", {});
    expect(result.details).toMatchObject({
      status: "error",
      error: expect.stringContaining("No Gemini API key"),
    });
  });

  it("reads key from config fallback", async () => {
    const manager = makeManager();
    const tool = createGeminiAuthTool(
      manager as any,
      {
        gemini_api_key: "config-key-123",
      } as any,
    );

    mocks.modelsList.mockResolvedValue({ page: [], pageLength: 5 });

    const result = await tool.execute("c", {});
    expect(result.details.status).toBe("authenticated");
    expect(manager.setKey).toHaveBeenCalledWith("default", "config-key-123");
  });

  it("uses explicit api_key over config", async () => {
    const manager = makeManager();
    const tool = createGeminiAuthTool(
      manager as any,
      {
        gemini_api_key: "config-key",
      } as any,
    );

    mocks.modelsList.mockResolvedValue({ page: [], pageLength: 3 });

    const result = await tool.execute("c", { api_key: "explicit-key" });
    expect(result.details.status).toBe("authenticated");
    expect(manager.setKey).toHaveBeenCalledWith("default", "explicit-key");
  });

  it("validates key and stores on success", async () => {
    const manager = makeManager();
    const tool = createGeminiAuthTool(manager as any, {} as any);

    mocks.modelsList.mockResolvedValue({ page: [], pageLength: 10 });

    const result = await tool.execute("c", { api_key: "valid-key" });
    expect(result.details).toMatchObject({
      status: "authenticated",
      account: "default",
    });
    expect(manager.setKey).toHaveBeenCalledWith("default", "valid-key");
  });

  it("returns error when API call fails", async () => {
    const manager = makeManager();
    const tool = createGeminiAuthTool(manager as any, {} as any);

    mocks.modelsList.mockRejectedValue(new Error("Invalid API key"));

    const result = await tool.execute("c", { api_key: "bad-key" });
    expect(result.details).toMatchObject({
      status: "error",
      error: "Invalid API key",
    });
    expect(manager.setKey).not.toHaveBeenCalled();
  });

  it("supports custom account name", async () => {
    const manager = makeManager();
    const tool = createGeminiAuthTool(manager as any, {} as any);

    mocks.modelsList.mockResolvedValue({ page: [], pageLength: 5 });

    const result = await tool.execute("c", { api_key: "key-123", account: "work" });
    expect(result.details.account).toBe("work");
    expect(manager.setKey).toHaveBeenCalledWith("work", "key-123");
  });
});
