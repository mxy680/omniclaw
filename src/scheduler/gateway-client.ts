import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GatewayConfig {
  /** WebSocket URL, e.g. "ws://localhost:18789" */
  url: string;
  /** Auth token for the gateway */
  authToken: string;
  /** Timeout in ms for a single chat execution (default: 5 minutes) */
  timeoutMs?: number;
}

export interface ChatResult {
  response: string;
  runId: string | null;
}

// ---------------------------------------------------------------------------
// Gateway WebSocket client
// ---------------------------------------------------------------------------

/**
 * Headless WebSocket client that speaks the OpenClaw Gateway protocol.
 * Mirrors the iOS ChatService: connect handshake -> chat.send -> stream events.
 */
export class GatewayClient {
  private config: GatewayConfig;
  private requestCounter = 0;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  private nextId(): string {
    this.requestCounter += 1;
    return `scheduler-${this.requestCounter}`;
  }

  /**
   * Open a WebSocket, authenticate, send a chat message, accumulate the
   * streaming response, and resolve when the gateway sends "final" or reject
   * on "error".  The socket is closed after each call (one-shot).
   */
  async executeChat(agentId: string, instruction: string, sessionSuffix?: string): Promise<ChatResult> {
    const sessionKey = `agent:${agentId}:cron-${sessionSuffix ?? randomUUID()}`;
    const timeoutMs = this.config.timeoutMs ?? 5 * 60 * 1000;

    return new Promise<ChatResult>((resolve, reject) => {
      const ws = new WebSocket(this.config.url);
      let runId: string | null = null;
      let responseText = "";
      let connected = false;
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
        ws.close();
      };

      const timer = setTimeout(() => {
        settle(() => reject(new Error("Gateway chat timed out")));
      }, timeoutMs);

      ws.addEventListener("open", () => {
        ws.send(
          JSON.stringify({
            type: "req",
            id: this.nextId(),
            method: "connect",
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: { id: "openclaw-cli", version: "1.0.0", platform: "node", mode: "cli" },
              role: "operator",
              scopes: ["operator.read", "operator.write"],
              auth: { token: this.config.authToken },
            },
          }),
        );
      });

      ws.addEventListener("message", (event) => {
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
        } catch {
          return;
        }

        const type = json.type as string;

        // --- handshake phase ---
        if (!connected) {
          if (type === "event") return; // skip events during handshake
          if (type === "res") {
            if (json.ok === true) {
              connected = true;
              // Send chat.send
              ws.send(
                JSON.stringify({
                  type: "req",
                  id: this.nextId(),
                  method: "chat.send",
                  params: { sessionKey, message: instruction, idempotencyKey: randomUUID() },
                }),
              );
            } else {
              settle(() => reject(new Error(`Gateway connection rejected: ${JSON.stringify(json.error)}`)));
            }
          }
          return;
        }

        // --- chat phase ---
        if (type === "res") {
          const payload = json.payload as Record<string, unknown> | undefined;
          if (json.ok === true && payload?.runId) {
            runId = payload.runId as string;
          } else if (json.ok === false) {
            const err = json.error as Record<string, unknown> | undefined;
            settle(() => reject(new Error(`chat.send failed: ${err?.message ?? "unknown"}`)));
          }
          return;
        }

        if (type === "event" && json.event === "chat") {
          const payload = json.payload as Record<string, unknown> | undefined;
          if (!payload) return;
          const state = payload.state as string;

          if (state === "delta" || state === "final") {
            // Gateway sends full text so far (not incremental deltas)
            const message = payload.message as Record<string, unknown> | undefined;
            if (message?.content) {
              const blocks = message.content as Array<{ type: string; text: string }>;
              responseText = blocks
                .filter((b) => b.type === "text")
                .map((b) => b.text)
                .join("");
            } else if (typeof message === "string") {
              responseText = message;
            }

            if (state === "final") {
              settle(() => resolve({ response: responseText, runId }));
            }
          } else if (state === "error") {
            const errorMsg = (payload.errorMessage as string) ?? "unknown agent error";
            settle(() => reject(new Error(`Agent error: ${errorMsg}`)));
          } else if (state === "aborted") {
            settle(() => resolve({ response: responseText, runId }));
          }
        }
      });

      ws.addEventListener("error", () => {
        settle(() => reject(new Error(`WebSocket connection to ${this.config.url} failed`)));
      });
    });
  }
}
