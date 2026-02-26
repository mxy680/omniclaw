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
  | { type: "conversation_rename"; conversationId: string; title: string }
  | { type: "fitness_day"; date: string };

/** Server → Client messages */
export type WsServerMessage =
  | { type: "auth_ok" }
  | { type: "auth_fail"; reason: string }
  | { type: "message"; text: string; id: string; conversationId: string; isUser?: boolean }
  | { type: "typing"; active: boolean; conversationId: string }
  | { type: "tool_use"; name: string; phase: "start" | "end"; conversationId: string; params?: unknown; durationMs?: number; result?: unknown }
  | { type: "error"; message: string }
  | { type: "conversation_list"; conversations: WsConversation[] }
  | { type: "conversation_created"; conversation: WsConversation }
  | { type: "conversation_history"; conversationId: string; messages: WsMessage[] }
  | { type: "conversation_deleted"; conversationId: string }
  | { type: "conversation_renamed"; conversationId: string; title: string }
  | { type: "conversation_updated"; conversation: WsConversation }
  | { type: "fitness_day"; data: WsFitnessDay };

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

/** Fitness day data as sent over the wire. */
export type WsFitnessDay = {
  date: string;
  food_entries: Array<{
    id: number;
    meal: string | null;
    food_name: string;
    serving: string | null;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number | null;
    sodium_mg: number | null;
  }>;
  daily_totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sodium_mg: number;
  } | null;
  targets: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sodium_mg?: number;
  } | null;
  exercises: Array<{
    id: number;
    name: string;
    exercise_type: string | null;
    duration_min: number | null;
    calories_burned: number | null;
    details: unknown;
  }>;
  biometrics: Array<{
    metric: string;
    value: number;
    unit: string;
    date: string;
  }>;
  weight_trend: Array<{ date: string; value: number }>;
  week_exercises: Array<{ date: string }>;
  meal_plan: WsMealPlanEntry[];
};

export type WsMealPlanEntry = {
  id: number;
  time_slot: string;
  meal_label: string;
  source: string;
  source_id: string | null;
  item_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  notes: string | null;
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
