/** Resolved account configuration for the iOS WebSocket channel. */
export type ResolvedIosAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  port: number;
  authToken: string;
};

// ── WebSocket protocol messages ──────────────────────────────────────

/** Client → Server messages */
export type WsClientMessage =
  | { type: "auth"; token: string }
  | { type: "message"; text: string; id?: string };

/** Server → Client messages */
export type WsServerMessage =
  | { type: "auth_ok" }
  | { type: "auth_fail"; reason: string }
  | { type: "message"; text: string; id: string }
  | { type: "typing"; active: boolean }
  | { type: "tool_use"; name: string; phase: "start" | "end" }
  | { type: "error"; message: string };

/** Core config shape (channels section of the OpenClaw main config). */
export type CoreConfig = {
  channels?: {
    "omniclaw-ios"?: {
      enabled?: boolean;
      port?: number;
      authToken?: string;
    };
  };
  session?: {
    store?: string;
  };
  [key: string]: unknown;
};
