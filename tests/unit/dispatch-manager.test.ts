import { describe, it, expect, vi, beforeEach } from "vitest";
import { DispatchManager } from "../../src/channel/dispatch-manager.js";

describe("DispatchManager", () => {
  let manager: DispatchManager;

  beforeEach(() => {
    manager = new DispatchManager({ maxConcurrency: 2, dispatchTimeoutMs: 5000 });
  });

  it("executes a dispatch immediately when slots available", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await manager.submit({
      conversationId: "c1",
      connId: "n1",
      priority: "interactive",
      fn,
    });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("runs two dispatches concurrently", async () => {
    const order: string[] = [];

    const p1 = manager.submit({
      conversationId: "c1",
      connId: "n1",
      priority: "interactive",
      fn: async () => {
        order.push("c1-start");
        await new Promise((r) => setTimeout(r, 100));
        order.push("c1-end");
      },
    });

    const p2 = manager.submit({
      conversationId: "c2",
      connId: "n2",
      priority: "interactive",
      fn: async () => {
        order.push("c2-start");
        await new Promise((r) => setTimeout(r, 50));
        order.push("c2-end");
      },
    });

    await Promise.all([p1, p2]);

    expect(order.indexOf("c1-start")).toBeLessThan(order.indexOf("c2-end"));
    expect(order.indexOf("c2-start")).toBeLessThan(order.indexOf("c1-end"));
  });

  it("queues third dispatch when at max concurrency", async () => {
    const order: string[] = [];

    const p1 = manager.submit({
      conversationId: "c1",
      connId: "n1",
      priority: "interactive",
      fn: async () => {
        order.push("c1-start");
        await new Promise((r) => setTimeout(r, 100));
        order.push("c1-end");
      },
    });

    const p2 = manager.submit({
      conversationId: "c2",
      connId: "n2",
      priority: "interactive",
      fn: async () => {
        order.push("c2-start");
        await new Promise((r) => setTimeout(r, 100));
        order.push("c2-end");
      },
    });

    const p3 = manager.submit({
      conversationId: "c3",
      connId: "n3",
      priority: "interactive",
      fn: async () => {
        order.push("c3-start");
        order.push("c3-end");
      },
    });

    await Promise.all([p1, p2, p3]);

    expect(order.indexOf("c3-start")).toBeGreaterThan(
      Math.min(order.indexOf("c1-end"), order.indexOf("c2-end")),
    );
  });

  it("prioritizes interactive over background", async () => {
    const mgr = new DispatchManager({ maxConcurrency: 1, dispatchTimeoutMs: 5000 });
    const order: string[] = [];

    const p1 = mgr.submit({
      conversationId: "c1",
      connId: "n1",
      priority: "interactive",
      fn: async () => {
        await new Promise((r) => setTimeout(r, 50));
        order.push("c1");
      },
    });

    const pBg = mgr.submit({
      conversationId: "bg",
      connId: "n-bg",
      priority: "background",
      fn: async () => { order.push("bg"); },
    });

    const p2 = mgr.submit({
      conversationId: "c2",
      connId: "n2",
      priority: "interactive",
      fn: async () => { order.push("c2"); },
    });

    await Promise.all([p1, pBg, p2]);

    expect(order).toEqual(["c1", "c2", "bg"]);
  });

  it("rejects duplicate dispatch for same conversation", async () => {
    const p1 = manager.submit({
      conversationId: "c1",
      connId: "n1",
      priority: "interactive",
      fn: () => new Promise((r) => setTimeout(r, 200)),
    });

    await expect(
      manager.submit({
        conversationId: "c1",
        connId: "n1",
        priority: "interactive",
        fn: async () => {},
      }),
    ).rejects.toThrow(/already processing/);

    await p1;
  });

  it("rejects duplicate dispatch for conversation in queue", async () => {
    const mgr = new DispatchManager({ maxConcurrency: 1, dispatchTimeoutMs: 5000 });

    // Fill the single slot
    const p1 = mgr.submit({
      conversationId: "c1",
      connId: "n1",
      priority: "interactive",
      fn: () => new Promise((r) => setTimeout(r, 200)),
    });

    // Queue c2
    const p2 = mgr.submit({
      conversationId: "c2",
      connId: "n2",
      priority: "interactive",
      fn: async () => {},
    });

    // Try to submit c2 again — should reject since c2 is in queue
    await expect(
      mgr.submit({
        conversationId: "c2",
        connId: "n2",
        priority: "interactive",
        fn: async () => {},
      }),
    ).rejects.toThrow(/already processing/);

    await Promise.all([p1, p2]);
  });

  it("times out long-running dispatches", async () => {
    const mgr = new DispatchManager({ maxConcurrency: 1, dispatchTimeoutMs: 100 });

    await expect(
      mgr.submit({
        conversationId: "c1",
        connId: "n1",
        priority: "interactive",
        fn: () => new Promise((r) => setTimeout(r, 5000)),
      }),
    ).rejects.toThrow(/timed out/);
  });

  it("frees slot after dispatch completes (even on error)", async () => {
    const mgr = new DispatchManager({ maxConcurrency: 1, dispatchTimeoutMs: 5000 });

    await mgr.submit({
      conversationId: "c1",
      connId: "n1",
      priority: "interactive",
      fn: async () => { throw new Error("boom"); },
    }).catch(() => {});

    const fn = vi.fn().mockResolvedValue(undefined);
    await mgr.submit({
      conversationId: "c2",
      connId: "n2",
      priority: "interactive",
      fn,
    });
    expect(fn).toHaveBeenCalledOnce();
  });
});
