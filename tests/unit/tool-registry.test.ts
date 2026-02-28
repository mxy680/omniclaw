import { describe, it, expect } from "vitest";
import { createAllTools } from "../../src/mcp/tool-registry.js";

describe("createAllTools", () => {
  it("returns tools with correct shape (no Google OAuth)", () => {
    const tools = createAllTools({ pluginConfig: {} as any });
    expect(tools.length).toBeGreaterThan(50);
    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe("string");
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe("string");
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe("object");
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("includes Google tools when client_secret_path is provided", () => {
    const tools = createAllTools({
      pluginConfig: { client_secret_path: "/tmp/fake-secret.json" } as any,
    });
    const gmailTools = tools.filter((t) => t.name.startsWith("gmail_"));
    expect(gmailTools.length).toBeGreaterThan(0);
  });

  it("has unique tool names", () => {
    const tools = createAllTools({ pluginConfig: {} as any });
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("does not include background_worker", () => {
    const tools = createAllTools({ pluginConfig: {} as any });
    const bgTool = tools.find((t) => t.name === "background_worker");
    expect(bgTool).toBeUndefined();
  });
});
