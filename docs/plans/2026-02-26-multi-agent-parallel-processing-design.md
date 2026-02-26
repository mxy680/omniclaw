# Multi-Agent Parallel Processing

## Problem

The current architecture processes one agent dispatch at a time via global state in `active-context.ts`. The OpenClaw SDK's `dispatchReplyWithBufferedBlockDispatcher` uses globals internally and cannot be modified. This blocks parallel conversation processing and background workers.

## Solution: Child Process Pool

Full process isolation via `child_process.fork()`. A pool of pre-forked worker processes each initialize the SDK runtime independently. The main process owns WebSocket, SQLite, and conversation management. Workers are stateless compute — they run the SDK dispatch and stream results back via IPC.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Main Process                    │
│                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ WS Server│  │ Conversation │  │   Pool     │  │
│  │          │──│   Router     │──│  Manager   │  │
│  │ (auth,   │  │ (SQLite,     │  │ (spawn,    │  │
│  │  send,   │  │  CRUD,       │  │  assign,   │  │
│  │  recv)   │  │  broadcast)  │  │  reclaim)  │  │
│  └──────────┘  └──────────────┘  └─────┬─────┘  │
│                                        │         │
└────────────────────────────────────────┼─────────┘
                                         │ IPC (fork)
                    ┌────────────────────┼────────────────────┐
                    │                    │                     │
              ┌─────▼─────┐       ┌──────▼────┐        ┌──────▼────┐
              │  Worker 1  │       │ Worker 2  │        │ Worker N  │
              │ SDK runtime│       │SDK runtime│        │SDK runtime│
              │ dispatch() │       │dispatch() │        │dispatch() │
              └────────────┘       └───────────┘        └───────────┘
```

## IPC Protocol

### Main → Worker

```typescript
// Dispatch a user message to the agent
{ type: "dispatch",
  id: string,              // unique request ID
  conversationId: string,
  connId: string,
  text: string,
  config: CoreConfig,
  sessionContext: object }

// Graceful shutdown
{ type: "shutdown" }
```

### Worker → Main

```typescript
// Agent reply chunk
{ type: "reply",
  id: string,
  conversationId: string,
  text: string }

// Tool use lifecycle
{ type: "tool_use",
  id: string,
  conversationId: string,
  name: string,
  phase: "start" | "end" }

// Dispatch complete
{ type: "done",
  id: string,
  conversationId: string }

// Error during dispatch
{ type: "error",
  id: string,
  conversationId: string,
  message: string }

// Worker ready after initialization
{ type: "ready" }
```

Workers never touch SQLite or WebSocket directly. All state management stays in the main process.

## Pool Manager

### Worker state

```typescript
type WorkerState = {
  process: ChildProcess;
  status: "initializing" | "idle" | "busy";
  currentDispatchId: string | null;
  currentConversationId: string | null;
};
```

### Assignment logic

1. Message arrives for conversation X
2. If a worker is already handling conversation X, queue the message (per-conversation FIFO)
3. If no worker is handling X, pick an idle worker and assign it
4. If no idle workers, add to a global queue. When a worker finishes, it picks the oldest queued message

### Failure handling

- Worker crash: detect `exit` event, respawn, send error to client for in-flight dispatch
- Worker timeout: configurable max dispatch time (default 5 min), kill and respawn if exceeded
- Startup failure: kill and retry up to 3 times if worker never sends `ready` within 30s

### Configuration

```typescript
type PoolConfig = {
  maxWorkers: number;        // default 3
  dispatchTimeoutMs: number; // default 300_000 (5 min)
  workerStartupMs: number;   // default 30_000
};
```

Exposed in `openclaw.plugin.json` so users can tune based on hardware.

## Background Workers

Background workers reuse the same child process pool. They are longer-running dispatches with a different origin.

### Flow

1. Agent decides to spawn background work during a conversation
2. Agent calls `spawn_background_worker` tool
3. Tool sends IPC message to main process requesting a background dispatch
4. Main process assigns a worker from the pool (background tasks are lower priority than interactive messages)
5. Worker runs the dispatch, streams results back
6. Main process posts results into the originating conversation

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

Interactive messages always take priority over background workers. If the pool is full and a user message arrives, the oldest queued background task stays queued.

### Status reporting (minimal, v1)

Background worker posts into target conversation:
- "Background task started: {task}"
- "Background task completed: {summary}" or "Background task failed: {error}"

Architecture supports adding a dedicated Workers panel later via new WebSocket message types.

## File Changes

### Modified

| File | Change |
|---|---|
| `src/channel/inbound.ts` | Remove direct SDK dispatch. Build context payload, hand to Pool Manager. Receive results via callback, handle SQLite + WebSocket delivery. |
| `src/channel/active-context.ts` | Replace globals with per-dispatch context map keyed by request ID. |
| `src/channel/channel-plugin.ts` | Initialize Pool Manager on startup, shut down on deactivate. |
| `openclaw.plugin.json` | Add `pool` config section. |
| `src/types/plugin-config.ts` | Add `PoolConfig` to `PluginConfig`. |

### New

| File | Purpose |
|---|---|
| `src/channel/pool-manager.ts` | Pool Manager — spawn, manage, assign workers, handle failures. |
| `src/channel/worker.ts` | Worker entry point — SDK init, IPC listener, dispatch runner. |
| `src/channel/pool-types.ts` | Shared IPC message types. |
| `src/tools/background-worker.ts` | `spawn_background_worker` tool. |

### Unchanged

- `ws-server.ts` — still handles connections and auth
- `conversation-store.ts` — still single-writer from main process
- `conversation-handlers.ts` — CRUD stays in main process
