import { describe, it, expect } from "vitest";
import { createAllTools } from "../../src/mcp/tool-registry.js";

describe("createAllTools", () => {
  it("returns non-OAuth tools with no OAuth config", () => {
    const tools = createAllTools({ pluginConfig: {} as any });
    // Without client_secret_path, only non-OAuth tools: YouTube (2) + Schedule (5) + Soul (2) + Attachment (1) + GitHub (102) + Gemini (4) + Wolfram (2)
    expect(tools.length).toBe(118);
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
    // With OAuth, should have 50+ tools
    expect(tools.length).toBeGreaterThan(50);
  });

  it("has unique tool names", () => {
    const tools = createAllTools({
      pluginConfig: { client_secret_path: "/tmp/fake-secret.json" } as any,
    });
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
