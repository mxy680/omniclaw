import { describe, it, expect, vi } from "vitest";
import { createBackgroundWorkerTool } from "../../src/tools/background-worker.js";

describe("spawn_background_worker tool", () => {
  it("has correct name and parameters", () => {
    const tool = createBackgroundWorkerTool({ submitBackground: vi.fn() });
    expect(tool.name).toBe("spawn_background_worker");
    expect(tool.parameters.properties).toHaveProperty("task");
  });

  it("calls submitBackground with task and conversation", async () => {
    const submitBackground = vi.fn().mockResolvedValue("bg-123");
    const tool = createBackgroundWorkerTool({ submitBackground });

    const result = await tool.execute("call-1", {
      task: "Research the weather in NYC",
    });

    expect(submitBackground).toHaveBeenCalledWith({
      task: "Research the weather in NYC",
      reportToConversation: undefined,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("started");
    expect(parsed.taskId).toBe("bg-123");
  });
});
