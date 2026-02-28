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
  | { type: "message"; text: string; id?: string; conversationId: string; attachments?: WsAttachment[] }
  | { type: "conversation_list" }
  | { type: "conversation_create"; id: string; title?: string }
  | { type: "conversation_history"; conversationId: string; before?: number; limit?: number }
  | { type: "conversation_delete"; conversationId: string }
  | { type: "conversation_rename"; conversationId: string; title: string }
  | { type: "fitness_day"; date: string }
  | { type: "project_list" }
  | { type: "project_get"; projectId: string }
  | { type: "project_delete"; projectId: string };

export type WsConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type WsMessage = {
  id: string;
  conversationId: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  toolUses: { name: string; phase: string }[] | null;
  isStreaming: boolean;
  attachments?: WsAttachment[] | null;
};

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
    potassium_mg: number;
  } | null;
  targets: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sodium_mg?: number;
    potassium_mg?: number;
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
  pantry_items: WsPantryItem[];
  workout_plan: WsWorkoutPlan | null;
  week_workout_plans: Array<{ date: string }>;
};

export type WsPantryItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  calories_per_serving: number | null;
  protein_g_per_serving: number | null;
  carbs_g_per_serving: number | null;
  fat_g_per_serving: number | null;
  serving_size: string | null;
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
  fiber_g: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  notes: string | null;
};

export type WsWorkoutPlanExercise = {
  id: number;
  exercise_order: number;
  exercise_name: string;
  target_sets: { reps: number; weight: number }[] | null;
  duration_min: number | null;
  distance: number | null;
  notes: string | null;
};

export type WsWorkoutPlan = {
  workout_name: string;
  workout_type: string;
  exercises: WsWorkoutPlanExercise[];
};

export type WsProject = {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  links: WsProjectLink[];
};

export type WsProjectLink = {
  id: string;
  platform: string;
  identifier: string;
  displayName: string;
  metadata: unknown;
};

export type WsAttachment = {
  fileId: string;
  filename: string;
  mimeType: string;
  size?: number;
  url?: string;
};

export type ServerMessage =
  | { type: "auth_ok" }
  | { type: "auth_fail"; reason: string }
  | { type: "message"; text: string; id: string; conversationId: string; isUser?: boolean; attachments?: WsAttachment[] }
  | { type: "typing"; active: boolean; conversationId: string }
  | { type: "tool_use"; name: string; phase: "start" | "end"; conversationId: string; params?: Record<string, unknown>; result?: string; durationMs?: number }
  | { type: "reasoning"; text: string; conversationId: string }
  | { type: "partial_reply"; text: string; conversationId: string }
  | { type: "assistant_message_start"; conversationId: string }
  | { type: "error"; message: string }
  | { type: "conversation_list"; conversations: WsConversation[] }
  | { type: "conversation_created"; conversation: WsConversation }
  | { type: "conversation_history"; conversationId: string; messages: WsMessage[] }
  | { type: "conversation_deleted"; conversationId: string }
  | { type: "conversation_renamed"; conversationId: string; title: string }
  | { type: "conversation_updated"; conversation: WsConversation }
  | { type: "fitness_day"; data: WsFitnessDay }
  | { type: "project_list"; projects: WsProject[] }
  | { type: "project_data"; project: WsProject; links: WsProjectLink[] }
  | { type: "project_created"; project: WsProject }
  | { type: "project_updated"; project: WsProject }
  | { type: "project_deleted"; projectId: string }
  | { type: "project_link_added"; projectId: string; link: WsProjectLink }
  | { type: "project_link_removed"; projectId: string; linkId: string };

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
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
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
    this.stopHeartbeat();
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
        this.startHeartbeat();
      } else if (msg.type === "auth_fail") {
        this.setState("error", msg.reason);
        this.ws?.close();
        return;
      }

      this.callbacks.onMessage?.(msg);
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
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

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
