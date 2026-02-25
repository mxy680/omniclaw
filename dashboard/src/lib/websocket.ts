// WebSocket client for the Omniclaw agent channel.
// Mirrors the protocol from src/channel/types.ts and the iOS WebSocketService.

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "error";

// ── Protocol types ─────────────────────────────────────────────────

export type ClientMessage =
  | { type: "auth"; token: string }
  | { type: "message"; text: string; id?: string };

export type ServerMessage =
  | { type: "auth_ok" }
  | { type: "auth_fail"; reason: string }
  | { type: "message"; text: string; id: string }
  | { type: "typing"; active: boolean }
  | { type: "tool_use"; name: string; phase: "start" | "end" }
  | { type: "error"; message: string };

// ── Event callbacks ────────────────────────────────────────────────

export interface WebSocketCallbacks {
  onStateChange?: (state: ConnectionState, error?: string) => void;
  onMessage?: (msg: ServerMessage) => void;
}

// ── Client ─────────────────────────────────────────────────────────

const MAX_RECONNECT_DELAY = 30_000;

export class AgentWebSocket {
  private ws: WebSocket | null = null;
  private url = "";
  private token = "";
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: WebSocketCallbacks;

  state: ConnectionState = "disconnected";

  constructor(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  connect(url: string, token: string) {
    this.url = url;
    this.token = token;
    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;
    this.performConnect();
  }

  disconnect() {
    this.intentionalDisconnect = true;
    this.clearReconnect();
    this.ws?.close(1000);
    this.ws = null;
    this.setState("disconnected");
  }

  send(msg: ClientMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  // ── Private ────────────────────────────────────────────────────

  private setState(state: ConnectionState, error?: string) {
    this.state = state;
    this.callbacks.onStateChange?.(state, error);
  }

  private performConnect() {
    this.ws?.close();
    this.setState("connecting");

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.setState("error", "Invalid WebSocket URL");
      return;
    }

    this.ws.onopen = () => {
      this.setState("authenticating");
      this.send({ type: "auth", token: this.token });
    };

    this.ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "auth_ok") {
        this.setState("connected");
        this.reconnectAttempts = 0;
      } else if (msg.type === "auth_fail") {
        this.setState("error", msg.reason);
        this.ws?.close();
        return;
      }

      this.callbacks.onMessage?.(msg);
    };

    this.ws.onclose = () => {
      if (!this.intentionalDisconnect && this.state !== "error") {
        this.setState("disconnected");
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror; don't double-handle
    };
  }

  private scheduleReconnect() {
    if (this.intentionalDisconnect) return;
    this.clearReconnect();
    const delay = Math.min(
      2 ** this.reconnectAttempts * 1000,
      MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.performConnect(), delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
