import type { WsServerInstance } from "./ws-server.js";

let server: WsServerInstance | null = null;

export function setWsServer(instance: WsServerInstance): void {
  server = instance;
}

export function getWsServer(): WsServerInstance | null {
  return server;
}

/**
 * Send a text message to a specific connection, or broadcast to all.
 * Returns a generated message ID.
 */
export function sendMessageIos(
  text: string,
  opts?: { connId?: string; conversationId?: string },
): { messageId: string } {
  if (!server) {
    throw new Error("iOS WebSocket server is not running");
  }

  const messageId = `ios-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const msg = {
    type: "message" as const,
    text,
    id: messageId,
    conversationId: opts?.conversationId ?? "",
  };

  if (opts?.connId) {
    server.send(opts.connId, msg);
  } else {
    server.broadcast(msg);
  }

  return { messageId };
}
