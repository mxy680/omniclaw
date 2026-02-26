/**
 * Tracks the currently-active conversation during agent reply dispatch.
 * Node.js is single-threaded, so a simple global works.
 */

let activeConversationId: string | null = null;
let activeConnId: string | null = null;

export function setActiveContext(conversationId: string, connId: string): void {
  activeConversationId = conversationId;
  activeConnId = connId;
}

export function getActiveContext(): {
  conversationId: string | null;
  connId: string | null;
} {
  return { conversationId: activeConversationId, connId: activeConnId };
}

export function clearActiveContext(): void {
  activeConversationId = null;
  activeConnId = null;
}
