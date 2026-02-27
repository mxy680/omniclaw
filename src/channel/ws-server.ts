import { randomUUID } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import type { WsClientMessage, WsServerMessage } from "./types.js";

export type WsConnectionHandler = (connId: string, msg: WsClientMessage) => void | Promise<void>;

export type WsServerInstance = {
  /** Send a message to a specific authenticated connection. */
  send: (connId: string, msg: WsServerMessage) => void;
  /** Broadcast a message to all authenticated connections. */
  broadcast: (msg: WsServerMessage) => void;
  /** Broadcast a message to all authenticated connections except one. */
  broadcastExcept: (excludeConnId: string, msg: WsServerMessage) => void;
  /** Stop the WebSocket server. */
  stop: () => void;
};

/**
 * Start a WebSocket server on the given port with token-based auth.
 *
 * Auth flow: the first message from a client must be `{type:"auth", token:"..."}`.
 * If the token matches, the connection is promoted to "authenticated" and an
 * `auth_ok` reply is sent. All subsequent `message` frames are forwarded to
 * `onMessage`. Un-authed connections that send anything other than a valid auth
 * frame receive `auth_fail` and are disconnected.
 */
export function startWsServer(opts: {
  port: number;
  authToken: string;
  onMessage: WsConnectionHandler;
  onConnect?: (connId: string) => void;
  onDisconnect?: (connId: string) => void;
  log?: (msg: string) => void;
  onReady?: () => void;
}): WsServerInstance {
  const { port, authToken, onMessage, onConnect, onDisconnect, log } = opts;

  const authed = new Map<string, WebSocket>();
  const pending = new Set<WebSocket>();
  const alive = new Set<WebSocket>();

  const wss = new WebSocketServer({ port });

  wss.on("listening", () => {
    log?.(`[ios] WebSocket server listening on port ${port}`);
    opts.onReady?.();
  });

  // Ping all clients every 30s; terminate if no pong received
  const pingInterval = setInterval(() => {
    for (const [, ws] of authed) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, 30_000);

  wss.on("connection", (ws) => {
    const connId = randomUUID();
    pending.add(ws);
    alive.add(ws);
    ws.on("pong", () => alive.add(ws));

    ws.on("message", (raw) => {
      let parsed: WsClientMessage;
      try {
        parsed = JSON.parse(String(raw)) as WsClientMessage;
      } catch {
        sendWs(ws, { type: "error", message: "invalid JSON" });
        return;
      }

      // If this connection hasn't authed yet, require auth message first
      if (pending.has(ws)) {
        if (parsed.type !== "auth") {
          sendWs(ws, { type: "auth_fail", reason: "auth required" });
          ws.close(4001, "auth required");
          pending.delete(ws);
          return;
        }
        if (parsed.token !== authToken) {
          sendWs(ws, { type: "auth_fail", reason: "invalid token" });
          ws.close(4003, "invalid token");
          pending.delete(ws);
          return;
        }
        // Authenticated!
        pending.delete(ws);
        authed.set(connId, ws);
        sendWs(ws, { type: "auth_ok" });
        log?.(`[ios] client ${connId} authenticated`);
        onConnect?.(connId);
        return;
      }

      // Already authed — forward the message
      Promise.resolve(onMessage(connId, parsed)).catch((err: unknown) => {
        log?.(`[ios] message handler error: ${(err as Error)?.stack ?? err}`);
        sendWs(ws, { type: "error", message: String(err) });
      });
    });

    ws.on("close", () => {
      pending.delete(ws);
      alive.delete(ws);
      if (authed.has(connId)) {
        authed.delete(connId);
        log?.(`[ios] client ${connId} disconnected`);
        onDisconnect?.(connId);
      }
    });

    ws.on("error", (err) => {
      log?.(`[ios] ws error (${connId}): ${err.message}`);
    });
  });

  wss.on("error", (err) => {
    log?.(`[ios] server error: ${err.message}`);
  });

  return {
    send(connId, msg) {
      const ws = authed.get(connId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendWs(ws, msg);
      }
    },
    broadcast(msg) {
      const payload = JSON.stringify(msg);
      for (const ws of authed.values()) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    },
    broadcastExcept(excludeConnId, msg) {
      const payload = JSON.stringify(msg);
      for (const [id, ws] of authed.entries()) {
        if (id !== excludeConnId && ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      }
    },
    stop() {
      clearInterval(pingInterval);
      for (const ws of authed.values()) {
        ws.close(1001, "server shutting down");
      }
      for (const ws of pending) {
        ws.close(1001, "server shutting down");
      }
      authed.clear();
      pending.clear();
      alive.clear();
      wss.close();
      log?.("[ios] WebSocket server stopped");
    },
  };
}

function sendWs(ws: WebSocket, msg: WsServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
