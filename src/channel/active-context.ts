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
