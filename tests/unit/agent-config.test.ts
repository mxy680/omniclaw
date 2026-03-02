import { describe, it, expect } from "vitest";
import {
  getToolService,
  isToolAllowed,
  filterToolsForAgent,
  type AgentConfig,
  type AgentPermissions,
} from "../../src/mcp/agent-config.js";

describe("getToolService", () => {
  it("extracts service from simple tool name", () => {
    expect(getToolService("gmail_send")).toBe("gmail");
    expect(getToolService("calendar_create")).toBe("calendar");
    expect(getToolService("drive_list")).toBe("drive");
    expect(getToolService("docs_get")).toBe("docs");
    expect(getToolService("sheets_update")).toBe("sheets");
    expect(getToolService("slides_get")).toBe("slides");
  });

  it("extracts service from multi-segment tool name", () => {
    expect(getToolService("youtube_get_transcript")).toBe("youtube");
    expect(getToolService("gmail_download_attachment")).toBe("gmail");
    expect(getToolService("drive_create_folder")).toBe("drive");
    expect(getToolService("calendar_list_calendars")).toBe("calendar");
  });
});

describe("isToolAllowed", () => {
  it("allows tool when service is in services list", () => {
    const perms: AgentPermissions = { services: ["gmail", "calendar"] };
    expect(isToolAllowed("gmail_send", perms)).toBe(true);
    expect(isToolAllowed("gmail_inbox", perms)).toBe(true);
    expect(isToolAllowed("calendar_create", perms)).toBe(true);
  });

  it("denies tool when service is not in services list", () => {
    const perms: AgentPermissions = { services: ["gmail"] };
    expect(isToolAllowed("calendar_create", perms)).toBe(false);
    expect(isToolAllowed("drive_list", perms)).toBe(false);
    expect(isToolAllowed("youtube_search", perms)).toBe(false);
  });

  it("denies tool in denyTools even if service is allowed", () => {
    const perms: AgentPermissions = {
      services: ["gmail"],
      denyTools: ["gmail_send", "gmail_reply", "gmail_forward"],
    };
    expect(isToolAllowed("gmail_send", perms)).toBe(false);
    expect(isToolAllowed("gmail_reply", perms)).toBe(false);
    expect(isToolAllowed("gmail_forward", perms)).toBe(false);
  });

  it("allows other tools in service when only specific tools are denied", () => {
    const perms: AgentPermissions = {
      services: ["gmail"],
      denyTools: ["gmail_send"],
    };
    expect(isToolAllowed("gmail_inbox", perms)).toBe(true);
    expect(isToolAllowed("gmail_search", perms)).toBe(true);
    expect(isToolAllowed("gmail_get", perms)).toBe(true);
  });

  it("handles empty services list", () => {
    const perms: AgentPermissions = { services: [] };
    expect(isToolAllowed("gmail_send", perms)).toBe(false);
    expect(isToolAllowed("calendar_create", perms)).toBe(false);
  });

  it("handles undefined denyTools", () => {
    const perms: AgentPermissions = { services: ["gmail"] };
    expect(isToolAllowed("gmail_send", perms)).toBe(true);
  });
});

describe("filterToolsForAgent", () => {
  const mockTools = [
    { name: "gmail_inbox" },
    { name: "gmail_send" },
    { name: "gmail_search" },
    { name: "calendar_events" },
    { name: "calendar_create" },
    { name: "drive_list" },
    { name: "youtube_search" },
  ];

  function makeAgent(permissions: AgentPermissions): AgentConfig {
    return {
      id: "test",
      name: "Test",
      role: "Test",
      systemPrompt: "",
      colorName: "blue",
      permissions,
      workspace: "/tmp/test",
    };
  }

  it("filters to only allowed services", () => {
    const agent = makeAgent({ services: ["gmail"] });
    const filtered = filterToolsForAgent(mockTools, agent);
    expect(filtered.map((t) => t.name)).toEqual([
      "gmail_inbox",
      "gmail_send",
      "gmail_search",
    ]);
  });

  it("filters with multiple services", () => {
    const agent = makeAgent({ services: ["gmail", "calendar"] });
    const filtered = filterToolsForAgent(mockTools, agent);
    expect(filtered.map((t) => t.name)).toEqual([
      "gmail_inbox",
      "gmail_send",
      "gmail_search",
      "calendar_events",
      "calendar_create",
    ]);
  });

  it("applies denyTools within allowed services", () => {
    const agent = makeAgent({
      services: ["gmail"],
      denyTools: ["gmail_send"],
    });
    const filtered = filterToolsForAgent(mockTools, agent);
    expect(filtered.map((t) => t.name)).toEqual(["gmail_inbox", "gmail_search"]);
  });

  it("returns all tools when all services are allowed", () => {
    const agent = makeAgent({
      services: ["gmail", "calendar", "drive", "youtube"],
    });
    const filtered = filterToolsForAgent(mockTools, agent);
    expect(filtered.length).toBe(mockTools.length);
  });

  it("returns empty when no services are allowed", () => {
    const agent = makeAgent({ services: [] });
    const filtered = filterToolsForAgent(mockTools, agent);
    expect(filtered.length).toBe(0);
  });
});
