import { describe, it, expect } from "vitest";
import {
  runWithContext,
  getActiveContext,
} from "../../src/channel/active-context.js";

describe("active-context (AsyncLocalStorage)", () => {
  it("returns null context outside of runWithContext", () => {
    const ctx = getActiveContext();
    expect(ctx.conversationId).toBeNull();
    expect(ctx.connId).toBeNull();
  });

  it("returns the correct context inside runWithContext", async () => {
    await runWithContext("conv-1", "conn-1", async () => {
      const ctx = getActiveContext();
      expect(ctx.conversationId).toBe("conv-1");
      expect(ctx.connId).toBe("conn-1");
    });
  });

  it("isolates concurrent contexts", async () => {
    const results: string[] = [];

    await Promise.all([
      runWithContext("conv-A", "conn-A", async () => {
        await new Promise((r) => setTimeout(r, 50));
        const ctx = getActiveContext();
        results.push(`A:${ctx.conversationId}`);
      }),
      runWithContext("conv-B", "conn-B", async () => {
        await new Promise((r) => setTimeout(r, 10));
        const ctx = getActiveContext();
        results.push(`B:${ctx.conversationId}`);
      }),
    ]);

    expect(results).toContain("A:conv-A");
    expect(results).toContain("B:conv-B");
  });

  it("context is null after runWithContext completes", async () => {
    await runWithContext("conv-1", "conn-1", async () => {});
    const ctx = getActiveContext();
    expect(ctx.conversationId).toBeNull();
  });
});
