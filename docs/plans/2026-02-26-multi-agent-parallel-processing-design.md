# Multi-Agent Parallel Processing

## Problem

The current architecture processes one agent dispatch at a time via global state in `active-context.ts`. The `wrapToolWithBroadcast` function in `plugin.ts` reads this global to route tool-use events to the correct conversation. This blocks parallel conversation processing and background workers.

## Why Not Child Processes

The SDK's `dispatchReplyWithBufferedBlockDispatcher` lives on the `PluginRuntime` object, which is bootstrapped by the OpenClaw host application — not by us. A child process cannot create its own `PluginRuntime`. However, analysis shows:

1. The SDK dispatch takes explicit parameters (ctx, cfg, callbacks) — no globals
2. The only global state problem is our code: `active-context.ts`
3. The WS server already fires message handlers concurrently via `Promise.resolve()`
4. Dispatches are I/O-bound (API calls), so they naturally interleave on the event loop

## Solution: AsyncLocalStorage + Dispatch Manager

Replace global `active-context.ts` with Node.js `AsyncLocalStorage` for per-dispatch context isolation. Add a Dispatch Manager with a configurable concurrency semaphore and priority queue.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                     Single Process                      │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ WS Server│  │ Conversation │  │   Dispatch        │  │
│  │          │──│   Router     │──│   Manager         │  │
│  │ (auth,   │  │ (SQLite,     │  │ (semaphore,       │  │
│  │  send,   │  │  CRUD,       │  │  priority queue,  │  │
│  │  recv)   │  │  broadcast)  │  │  AsyncLocalStore) │  │
│  └──────────┘  └──────────────┘  └────────┬─────────┘  │
│                                           │             │
│                          ┌────────────────┼──────────┐  │
│                          │                │          │  │
│                    ┌─────▼─────┐  ┌───────▼───┐  ┌──▼──┐
│                    │ Dispatch 1│  │ Dispatch 2│  │ ... │ │
│                    │ (conv A)  │  │ (conv B)  │  │     │ │
│                    │ AsyncLocal│  │ AsyncLocal│  │     │ │
│                    └───────────┘  └───────────┘  └─────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Each concurrent dispatch runs in its own `AsyncLocalStorage` context. The Dispatch Manager controls how many run at once.

## Dispatch Manager

### Concurrency control

```typescript
type DispatchSlot = {
  id: string;                    // unique dispatch ID
  conversationId: string;
  connId: string;
  priority: "interactive" | "background";
  abortController: AbortController;
};
```

### Assignment logic

1. Message arrives for conversation X
2. If conversation X already has an active dispatch, queue the message (per-conversation FIFO)
3. If a concurrency slot is available, start the dispatch immediately
4. If no slots available, add to priority queue (interactive > background)
5. When a dispatch finishes, pick the highest-priority queued item

### Timeout handling

- Configurable max dispatch time (default 5 min)
- AbortController signals timeout; dispatch handler catches and sends error to client

### Configuration

```typescript
type DispatchConfig = {
  maxConcurrency: number;          // default 3
  dispatchTimeoutMs: number;       // default 300_000 (5 min)
};
```

Exposed in `openclaw.plugin.json`.

## Background Workers

Background workers reuse the same dispatch slots with lower priority.

### Flow

1. Agent calls `spawn_background_worker` tool during a conversation
2. Tool creates a background dispatch request via the Dispatch Manager
3. Dispatch Manager queues it with `priority: "background"`
4. When a slot opens, the background dispatch runs
5. Results are posted into the originating conversation

### Tool

```typescript
{
  name: "spawn_background_worker",
  description: "Spawn a background task that runs independently",
  parameters: {
    task: string,
    reportToConversation?: string  // defaults to current conversation
  }
}
```

### Priority

Interactive messages always take priority. If all slots are busy and a user message arrives, it queues ahead of all background tasks.

### Status reporting (minimal, v1)

Background worker posts into target conversation:
- "Background task started: {task}"
- "Background task completed: {summary}" or "Background task failed: {error}"

## File Changes

### Modified

| File | Change |
|---|---|
| `src/channel/active-context.ts` | Replace globals with `AsyncLocalStorage`-based per-dispatch context |
| `src/channel/inbound.ts` | Run dispatch inside AsyncLocalStorage context; remove direct setActiveContext/clearActiveContext |
| `src/channel/channel-plugin.ts` | Initialize Dispatch Manager; route messages through it instead of directly calling handleIosInbound |
| `src/plugin.ts` | Update `wrapToolWithBroadcast` to read from AsyncLocalStorage instead of globals |
| `openclaw.plugin.json` | Add `dispatch` config section |
| `src/types/plugin-config.ts` | Add `DispatchConfig` to `PluginConfig` |

### New

| File | Purpose |
|---|---|
| `src/channel/dispatch-manager.ts` | Dispatch Manager — semaphore, priority queue, slot tracking |
| `src/tools/background-worker.ts` | `spawn_background_worker` tool |

### Unchanged

- `ws-server.ts` — still handles connections and auth
- `conversation-store.ts` — still single-writer from main process
- `conversation-handlers.ts` — CRUD stays in main process
- `send.ts` — unchanged
- `runtime.ts` — unchanged (singleton is safe for concurrent reads)
