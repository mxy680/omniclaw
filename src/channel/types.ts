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
  | { type: "message"; text: string; id?: string; conversationId: string }
  | { type: "conversation_list" }
  | { type: "conversation_create"; id: string; title?: string }
  | { type: "conversation_history"; conversationId: string; before?: number; limit?: number }
  | { type: "conversation_delete"; conversationId: string }
  | { type: "conversation_rename"; conversationId: string; title: string };

/** Server → Client messages */
export type WsServerMessage =
  | { type: "auth_ok" }
  | { type: "auth_fail"; reason: string }
  | { type: "message"; text: string; id: string; conversationId: string; isUser?: boolean }
  | { type: "typing"; active: boolean; conversationId: string }
  | { type: "tool_use"; name: string; phase: "start" | "end"; conversationId: string }
  | { type: "error"; message: string }
  | { type: "conversation_list"; conversations: WsConversation[] }
  | { type: "conversation_created"; conversation: WsConversation }
  | { type: "conversation_history"; conversationId: string; messages: WsMessage[] }
  | { type: "conversation_deleted"; conversationId: string }
  | { type: "conversation_renamed"; conversationId: string; title: string }
  | { type: "conversation_updated"; conversation: WsConversation };

/** Conversation as sent over the wire. */
export type WsConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

/** Message as sent over the wire. */
export type WsMessage = {
  id: string;
  conversationId: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  toolUses: { name: string; phase: string }[] | null;
  isStreaming: boolean;
};

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
