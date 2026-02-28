import type { WsTask } from "./task-types.js";
import type { JobRunStatus } from "./job-store.js";

/** Resolved account configuration for the iOS WebSocket channel. */
export type ResolvedIosAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  port: number;
  authToken: string;
};

/** Attachment metadata for file uploads. */
export type WsAttachment = {
  fileId: string;
  filename: string;
  mimeType: string;
  size?: number;
  url?: string;
};

// ── WebSocket protocol messages ──────────────────────────────────────

/** Client → Server messages */
export type WsClientMessage =
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
  | { type: "project_delete"; projectId: string }
  | { type: "task_list" }
  | { type: "task_execute"; taskId: string }
  | { type: "task_approve"; taskId: string }
  | { type: "task_delete"; taskId: string };

/** Server → Client messages */
export type WsServerMessage =
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
  | { type: "project_link_removed"; projectId: string; linkId: string }
  | { type: "task_list"; tasks: WsTask[] }
  | { type: "task_created"; task: WsTask }
  | { type: "task_updated"; task: WsTask }
  | { type: "task_deleted"; taskId: string }
  | { type: "job_created"; job: WsJob }
  | { type: "job_updated"; job: WsJob }
  | { type: "job_deleted"; jobId: string };

/** Job as sent over the wire (camelCase). */
export type WsJob = {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  mode: "tool" | "agent";
  toolName: string | null;
  toolParams: unknown;
  prompt: string | null;
  enabled: boolean;
  nextRunAt: number;
  lastRunAt: number | null;
  lastStatus: JobRunStatus | null;
  createdAt: number;
  updatedAt: number;
};

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
  attachments: WsAttachment[] | null;
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

/** Project as sent over the wire. */
export type WsProject = {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  links: WsProjectLink[];
};

/** Project link as sent over the wire. */
export type WsProjectLink = {
  id: string;
  platform: string;
  identifier: string;
  displayName: string;
  metadata: unknown;
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
