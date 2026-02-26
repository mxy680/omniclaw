# Multi-Agent Parallel Processing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable multiple conversations to process agent dispatches concurrently, with background worker support.

**Architecture:** Replace the global `active-context.ts` singleton with `AsyncLocalStorage` for per-dispatch context isolation. Add a Dispatch Manager with a configurable concurrency semaphore and priority queue. Background workers reuse the same dispatch slots with lower priority.

**Tech Stack:** Node.js `AsyncLocalStorage`, TypeScript, `@sinclair/typebox` for tool schemas.

---

### Task 1: Replace active-context.ts with AsyncLocalStorage

**Files:**
- Modify: `src/channel/active-context.ts`

The current file uses global variables to track the active conversation. Replace with `AsyncLocalStorage` so each concurrent dispatch gets its own isolated context.

**Step 1: Write the failing test**

Create `tests/unit/active-context.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  runWithContext,
  getActiveContext,
  clearActiveContext,
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/active-context.test.ts`
Expected: FAIL — `runWithContext` is not exported from active-context.ts

**Step 3: Write the implementation**

Replace `src/channel/active-context.ts` with:

```typescript
import { AsyncLocalStorage } from "node:async_hooks";

type DispatchContext = {
  conversationId: string;
  connId: string;
};

const storage = new AsyncLocalStorage<DispatchContext>();

/**
 * Run a callback within an isolated dispatch context.
 * Each concurrent dispatch gets its own conversationId/connId
 * via AsyncLocalStorage — no global state collisions.
 */
export function runWithContext<T>(
  conversationId: string,
  connId: string,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return storage.run({ conversationId, connId }, fn);
}

/**
 * Read the current dispatch context.
 * Returns nulls if called outside of runWithContext.
 */
export function getActiveContext(): {
  conversationId: string | null;
  connId: string | null;
} {
  const ctx = storage.getStore();
  return {
    conversationId: ctx?.conversationId ?? null,
    connId: ctx?.connId ?? null,
  };
}

// ── Backwards-compat shims (remove after Task 3) ──────────────────

/** @deprecated Use runWithContext instead */
export function setActiveContext(_conversationId: string, _connId: string): void {
  // no-op — context is now set via runWithContext
}

/** @deprecated Context is cleared automatically when runWithContext exits */
export function clearActiveContext(): void {
  // no-op
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/active-context.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add src/channel/active-context.ts tests/unit/active-context.test.ts
git commit -m "Replace active-context globals with AsyncLocalStorage"
```

---

### Task 2: Create the Dispatch Manager

**Files:**
- Create: `src/channel/dispatch-manager.ts`

The Dispatch Manager controls concurrency with a semaphore, queues overflow with priority, and tracks active dispatches.

**Step 1: Write the failing test**

Create `tests/unit/dispatch-manager.test.ts`:

```typescript
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

    // Both should have started before either finished
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

    // c3 should start after c1 or c2 finishes
    expect(order.indexOf("c3-start")).toBeGreaterThan(
      Math.min(order.indexOf("c1-end"), order.indexOf("c2-end")),
    );
  });

  it("prioritizes interactive over background", async () => {
    const mgr = new DispatchManager({ maxConcurrency: 1, dispatchTimeoutMs: 5000 });
    const order: string[] = [];

    // Fill the single slot
    const p1 = mgr.submit({
      conversationId: "c1",
      connId: "n1",
      priority: "interactive",
      fn: async () => {
        await new Promise((r) => setTimeout(r, 50));
        order.push("c1");
      },
    });

    // Queue a background task
    const pBg = mgr.submit({
      conversationId: "bg",
      connId: "n-bg",
      priority: "background",
      fn: async () => { order.push("bg"); },
    });

    // Queue an interactive task (should jump ahead of background)
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

    // Slot should be free — this should resolve immediately
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/dispatch-manager.test.ts`
Expected: FAIL — cannot resolve `../../src/channel/dispatch-manager.js`

**Step 3: Write the implementation**

Create `src/channel/dispatch-manager.ts`:

```typescript
import { runWithContext } from "./active-context.js";

export type DispatchPriority = "interactive" | "background";

export type DispatchRequest = {
  conversationId: string;
  connId: string;
  priority: DispatchPriority;
  fn: () => Promise<void>;
};

export type DispatchConfig = {
  maxConcurrency: number;
  dispatchTimeoutMs: number;
};

type QueuedItem = DispatchRequest & {
  resolve: () => void;
  reject: (err: Error) => void;
};

const DEFAULTS: DispatchConfig = {
  maxConcurrency: 3,
  dispatchTimeoutMs: 300_000,
};

export class DispatchManager {
  private config: DispatchConfig;
  private activeCount = 0;
  private activeConversations = new Set<string>();
  private queue: QueuedItem[] = [];

  constructor(config?: Partial<DispatchConfig>) {
    this.config = { ...DEFAULTS, ...config };
  }

  /**
   * Submit a dispatch for execution. Resolves when the dispatch completes.
   * Rejects if the conversation already has an active dispatch,
   * or if the dispatch times out or throws.
   */
  async submit(req: DispatchRequest): Promise<void> {
    if (this.activeConversations.has(req.conversationId)) {
      throw new Error(
        `Conversation ${req.conversationId} is already processing a dispatch`,
      );
    }

    if (this.activeCount < this.config.maxConcurrency) {
      return this.execute(req);
    }

    // Queue the request
    return new Promise<void>((resolve, reject) => {
      const item: QueuedItem = { ...req, resolve, reject };
      // Insert by priority: interactive before background
      if (req.priority === "interactive") {
        // Insert before first background item
        const idx = this.queue.findIndex((q) => q.priority === "background");
        if (idx === -1) {
          this.queue.push(item);
        } else {
          this.queue.splice(idx, 0, item);
        }
      } else {
        this.queue.push(item);
      }
    });
  }

  /** Number of currently active dispatches. */
  get active(): number {
    return this.activeCount;
  }

  /** Number of queued dispatches. */
  get queued(): number {
    return this.queue.length;
  }

  private async execute(req: DispatchRequest): Promise<void> {
    this.activeCount++;
    this.activeConversations.add(req.conversationId);

    try {
      await runWithContext(
        req.conversationId,
        req.connId,
        () => this.withTimeout(req.fn(), req.conversationId),
      );
    } finally {
      this.activeCount--;
      this.activeConversations.delete(req.conversationId);
      this.drain();
    }
  }

  private withTimeout(
    promise: Promise<void>,
    conversationId: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Dispatch for conversation ${conversationId} timed out after ${this.config.dispatchTimeoutMs}ms`,
          ),
        );
      }, this.config.dispatchTimeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  private drain(): void {
    while (this.activeCount < this.config.maxConcurrency && this.queue.length > 0) {
      const next = this.queue.shift()!;
      // Fire and resolve/reject the queued promise
      this.execute(next).then(next.resolve, next.reject);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/dispatch-manager.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/channel/dispatch-manager.ts tests/unit/dispatch-manager.test.ts
git commit -m "Add DispatchManager with concurrency semaphore and priority queue"
```

---

### Task 3: Wire active-context into inbound.ts

**Files:**
- Modify: `src/channel/inbound.ts`

Replace the `setActiveContext` / `clearActiveContext` calls with `runWithContext`, so each dispatch runs in its own AsyncLocalStorage context.

**Step 1: Modify inbound.ts**

In `src/channel/inbound.ts`, replace the dispatch section (lines 217-239):

Current code:
```typescript
  setActiveContext(conversationId, connId);
  try {
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      // ...
    });
  } finally {
    clearActiveContext();
    // Clear typing indicator
    wsServer.send(connId, { type: "typing", active: false, conversationId });
    wsServer.broadcastExcept(connId, { type: "typing", active: false, conversationId });
  }
```

New code:
```typescript
  await runWithContext(conversationId, connId, async () => {
    try {
      await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx: ctxPayload,
        cfg: config as OpenClawConfig,
        dispatcherOptions: {
          ...prefixOptions,
          deliver: deliverReply,
          onError: (err: unknown, info: { kind: string }) => {
            runtime.error?.(`ios ${info.kind} reply failed: ${String(err)}`);
            wsServer.send(connId, { type: "error", message: String(err) });
          },
        },
        replyOptions: {
          onModelSelected,
        },
      });
    } finally {
      // Clear typing indicator
      wsServer.send(connId, { type: "typing", active: false, conversationId });
      wsServer.broadcastExcept(connId, { type: "typing", active: false, conversationId });
    }
  });
```

Also update the imports at the top of the file:
- Remove: `import { setActiveContext, clearActiveContext } from "./active-context.js";`
- Add: `import { runWithContext } from "./active-context.js";`

**Step 2: Verify it builds**

Run: `pnpm build`
Expected: Compiles without errors

**Step 3: Commit**

```bash
git add src/channel/inbound.ts
git commit -m "Use runWithContext in inbound dispatch for AsyncLocalStorage isolation"
```

---

### Task 4: Remove deprecated shims from active-context.ts

**Files:**
- Modify: `src/channel/active-context.ts`
- Modify: `src/plugin.ts` (update import if needed)

Now that `inbound.ts` uses `runWithContext`, remove the deprecated `setActiveContext` and `clearActiveContext` shims. The `plugin.ts` file already uses `getActiveContext()` which works with AsyncLocalStorage — no change needed there.

**Step 1: Remove shims from active-context.ts**

Delete the backwards-compat section at the bottom of `src/channel/active-context.ts` (the `setActiveContext` and `clearActiveContext` functions).

**Step 2: Verify no remaining imports of removed functions**

Run: `grep -r "setActiveContext\|clearActiveContext" src/`
Expected: No results

**Step 3: Verify it builds**

Run: `pnpm build`
Expected: Compiles without errors

**Step 4: Run existing tests**

Run: `pnpm test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/channel/active-context.ts
git commit -m "Remove deprecated setActiveContext/clearActiveContext shims"
```

---

### Task 5: Wire Dispatch Manager into channel-plugin.ts

**Files:**
- Modify: `src/channel/channel-plugin.ts`
- Modify: `src/types/plugin-config.ts`

Route messages through the Dispatch Manager instead of calling `handleIosInbound` directly.

**Step 1: Add DispatchConfig to PluginConfig**

In `src/types/plugin-config.ts`, add to the interface:

```typescript
  dispatch_max_concurrency?: number;
  dispatch_timeout_ms?: number;
```

**Step 2: Modify channel-plugin.ts**

Import the Dispatch Manager and create it in `startAccount`. Route `message` type messages through it.

Add import:
```typescript
import { DispatchManager } from "./dispatch-manager.js";
```

In `startAccount` (after `const store = new ConversationStore();`, line 104), create the manager:

```typescript
      const dispatchManager = new DispatchManager({
        maxConcurrency: (ctx.cfg as any)?.plugins?.entries?.omniclaw?.config?.dispatch_max_concurrency ?? 3,
        dispatchTimeoutMs: (ctx.cfg as any)?.plugins?.entries?.omniclaw?.config?.dispatch_timeout_ms ?? 300_000,
      });
```

Replace the `onMessage` handler's message handling block (lines 130-146):

Current:
```typescript
          try {
            await handleIosInbound({
              // ...
            });
          } catch (err) {
            ctx.log?.info(`[ios] handleIosInbound error: ${err}`);
          }
```

New:
```typescript
          try {
            await dispatchManager.submit({
              conversationId: msg.conversationId,
              connId,
              priority: "interactive",
              fn: () =>
                handleIosInbound({
                  text: msg.text,
                  messageId: msg.id,
                  conversationId: msg.conversationId,
                  connId,
                  account,
                  config: cfg,
                  runtime,
                  store,
                  wsServer,
                  statusSink: (patch) =>
                    ctx.setStatus({ accountId: ctx.accountId, ...patch }),
                }),
            });
          } catch (err) {
            ctx.log?.info(`[ios] dispatch error: ${err}`);
            wsServer.send(connId, {
              type: "error",
              message: String(err),
            });
          }
```

**Step 3: Verify it builds**

Run: `pnpm build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add src/channel/channel-plugin.ts src/types/plugin-config.ts
git commit -m "Route messages through DispatchManager for concurrent processing"
```

---

### Task 6: Add dispatch config to openclaw.plugin.json

**Files:**
- Modify: `openclaw.plugin.json`

**Step 1: Add config schema entries**

Add to the `properties` object in `openclaw.plugin.json`:

```json
      "dispatch_max_concurrency": {
        "type": "number",
        "description": "Maximum number of concurrent agent dispatches. Each active dispatch handles one conversation at a time. Default: 3.",
        "default": 3
      },
      "dispatch_timeout_ms": {
        "type": "number",
        "description": "Maximum time in milliseconds for a single agent dispatch before it times out. Default: 300000 (5 minutes).",
        "default": 300000
      }
```

**Step 2: Commit**

```bash
git add openclaw.plugin.json
git commit -m "Add dispatch concurrency config to plugin schema"
```

---

### Task 7: Create the background worker tool

**Files:**
- Create: `src/tools/background-worker.ts`
- Modify: `src/plugin.ts`
- Modify: `src/channel/channel-plugin.ts`

This tool allows the agent to spawn background tasks. Since the tool executes within a dispatch context, it needs a reference to the Dispatch Manager.

**Step 1: Write the failing test**

Create `tests/unit/background-worker.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/background-worker.test.ts`
Expected: FAIL — cannot resolve module

**Step 3: Write the implementation**

Create `src/tools/background-worker.ts`:

```typescript
import { Type } from "@sinclair/typebox";

type BackgroundSubmitter = {
  submitBackground: (req: {
    task: string;
    reportToConversation?: string;
  }) => Promise<string>;
};

export function createBackgroundWorkerTool(submitter: BackgroundSubmitter) {
  return {
    name: "spawn_background_worker",
    label: "Spawn Background Worker",
    description:
      "Spawn a background task that runs independently of the current conversation. " +
      "The task will be processed when a dispatch slot is available. " +
      "Results are posted back to the originating conversation (or a specified one).",
    parameters: Type.Object({
      task: Type.String({
        description: "Description of what the background worker should do",
      }),
      reportToConversation: Type.Optional(
        Type.String({
          description:
            "Conversation ID to post results to. Defaults to the current conversation.",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { task: string; reportToConversation?: string },
    ) {
      const taskId = await submitter.submitBackground({
        task: params.task,
        reportToConversation: params.reportToConversation,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: "started",
              taskId,
              message: `Background task started: ${params.task}`,
            }),
          },
        ],
      };
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/background-worker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/background-worker.ts tests/unit/background-worker.test.ts
git commit -m "Add spawn_background_worker tool"
```

---

### Task 8: Wire background worker into plugin registration

**Files:**
- Modify: `src/channel/channel-plugin.ts`
- Modify: `src/plugin.ts`

The background worker tool needs access to the Dispatch Manager. Since tools are registered in `plugin.ts` but the Dispatch Manager lives in `channel-plugin.ts`, we use a late-binding pattern: expose a `submitBackground` function from channel-plugin that plugin.ts can reference.

**Step 1: Expose background submit from channel-plugin.ts**

Add to `src/channel/channel-plugin.ts`, after the imports:

```typescript
let activeDispatchManager: DispatchManager | null = null;

export function getDispatchManager(): DispatchManager | null {
  return activeDispatchManager;
}
```

In `startAccount`, after creating the dispatchManager, set it:

```typescript
      activeDispatchManager = dispatchManager;
```

In the `stop` function, clear it:

```typescript
        activeDispatchManager = null;
```

**Step 2: Register the tool in plugin.ts**

Add import to `src/plugin.ts`:

```typescript
import { createBackgroundWorkerTool } from "./tools/background-worker.js";
import { getDispatchManager } from "./channel/channel-plugin.js";
```

After the channel registration (`api.registerChannel(...)`) and before the first `reg(...)` call, add:

```typescript
  reg(createBackgroundWorkerTool({
    submitBackground: async (req) => {
      const manager = getDispatchManager();
      if (!manager) {
        throw new Error("Dispatch manager not initialized — iOS channel not running");
      }
      const ctx = getActiveContext();
      const conversationId = req.reportToConversation ?? ctx.conversationId;
      if (!conversationId) {
        throw new Error("No conversation context — cannot determine where to report results");
      }
      const taskId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Submit as background priority — will run when a slot opens
      // The dispatch manager will handle this asynchronously
      manager.submit({
        conversationId: `bg-${taskId}`,
        connId: ctx.connId ?? "",
        priority: "background",
        fn: async () => {
          // TODO: In a future task, this will dispatch the background
          // task text through the agent. For now, this is a placeholder
          // that establishes the plumbing.
        },
      }).catch((err) => {
        // Background tasks fail silently — errors logged but don't crash
        console.error(`[omniclaw] background task ${taskId} failed:`, err);
      });

      return taskId;
    },
  }));
```

**Step 3: Verify it builds**

Run: `pnpm build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add src/channel/channel-plugin.ts src/plugin.ts
git commit -m "Wire background worker tool into plugin registration"
```

---

### Task 9: Full integration verification

**Files:** None (verification only)

**Step 1: Run all unit tests**

Run: `pnpm test`
Expected: All pass

**Step 2: Verify the build**

Run: `pnpm build`
Expected: Clean compile, no errors

**Step 3: Verify no leftover references to old globals**

Run: `grep -r "setActiveContext\|clearActiveContext" src/`
Expected: No results

**Step 4: Commit the updated design doc**

```bash
git add docs/plans/
git commit -m "Update design doc to reflect AsyncLocalStorage approach"
```

---

### Summary of changes

| File | Action | Purpose |
|---|---|---|
| `src/channel/active-context.ts` | Modified | Globals → AsyncLocalStorage |
| `src/channel/dispatch-manager.ts` | Created | Concurrency semaphore + priority queue |
| `src/channel/inbound.ts` | Modified | Use `runWithContext` instead of set/clear globals |
| `src/channel/channel-plugin.ts` | Modified | Route messages through DispatchManager |
| `src/plugin.ts` | Modified | Register background worker tool |
| `src/types/plugin-config.ts` | Modified | Add dispatch config fields |
| `openclaw.plugin.json` | Modified | Add dispatch config schema |
| `src/tools/background-worker.ts` | Created | `spawn_background_worker` tool |
| `tests/unit/active-context.test.ts` | Created | AsyncLocalStorage isolation tests |
| `tests/unit/dispatch-manager.test.ts` | Created | Concurrency + priority tests |
| `tests/unit/background-worker.test.ts` | Created | Background tool tests |
