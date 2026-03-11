import { Type } from "@sinclair/typebox";
import type { XClientManager } from "../auth/x-client-manager.js";
import { jsonResult, authRequired } from "./shared.js";

const AUTH_REQUIRED = authRequired("x");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXDmConversationsTool(manager: XClientManager): any {
  return {
    name: "x_dm_conversations",
    label: "X DM Conversations",
    description: "List recent DM conversations.",
    parameters: Type.Object({
      cursor: Type.Optional(Type.String({ description: "Pagination cursor." })),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { cursor?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const p: Record<string, string> = {};
        if (params.cursor) p.cursor = params.cursor;

        const result = await client.v1<Record<string, unknown>>({
          path: "/dm/inbox_initial_state.json",
          params: p,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inboxState = result?.inbox_initial_state as any;
        const conversations = inboxState?.conversations ?? {};
        const users = inboxState?.users ?? {};

        const convList = Object.entries(conversations).map(([id, conv]: [string, unknown]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = conv as any;
          const participantIds = c.participants?.map((p: { user_id: string }) => p.user_id) ?? [];
          const participantNames = participantIds.map((uid: string) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const u = (users as any)[uid];
            return u ? { id: uid, name: u.name, screen_name: u.screen_name } : { id: uid };
          });
          return {
            id,
            type: c.type,
            participants: participantNames,
            last_read_event_id: c.last_read_event_id,
            sort_timestamp: c.sort_timestamp,
          };
        });

        return jsonResult({ conversations: convList });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXDmMessagesTool(manager: XClientManager): any {
  return {
    name: "x_dm_messages",
    label: "X DM Messages",
    description: "Get messages from a specific DM conversation.",
    parameters: Type.Object({
      conversation_id: Type.String({ description: "The conversation ID." }),
      max_id: Type.Optional(Type.String({ description: "Return messages before this ID for pagination." })),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { conversation_id: string; max_id?: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const p: Record<string, string> = {};
        if (params.max_id) p.max_id = params.max_id;

        const result = await client.v1<Record<string, unknown>>({
          path: `/dm/conversation/${params.conversation_id}.json`,
          params: p,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const convTimeline = result?.conversation_timeline as any;
        const entries = convTimeline?.entries ?? [];
        const users = convTimeline?.users ?? {};

        const messages = entries
          .filter((e: { message?: unknown }) => e.message)
          .map((e: { message: { message_data: { text: string; id: string; time: string; sender_id: string } } }) => {
            const msg = e.message.message_data;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sender = (users as any)[msg.sender_id];
            return {
              id: msg.id,
              text: msg.text,
              sender: sender
                ? { id: msg.sender_id, name: sender.name, screen_name: sender.screen_name }
                : { id: msg.sender_id },
              time: msg.time,
            };
          });

        return jsonResult({ conversation_id: params.conversation_id, messages });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createXDmSendTool(manager: XClientManager): any {
  return {
    name: "x_dm_send",
    label: "X DM Send",
    description: "Send a direct message to a user.",
    parameters: Type.Object({
      recipient_id: Type.String({ description: "The recipient's numeric user ID." }),
      text: Type.String({ description: "Message text." }),
      account: Type.Optional(Type.String({ description: "Account name.", default: "default" })),
    }),
    async execute(
      _toolCallId: string,
      params: { recipient_id: string; text: string; account?: string },
    ) {
      const account = params.account ?? "default";
      const client = manager.getClient(account);
      if (!client.isAuthenticated()) return jsonResult(AUTH_REQUIRED);
      try {
        const result = await client.v1<Record<string, unknown>>({
          method: "POST",
          path: "/dm/new2.json",
          body: {
            conversation_id: `${params.recipient_id}`,
            recipient_ids: false,
            request_id: crypto.randomUUID(),
            text: params.text,
          },
        });
        return jsonResult({ sent: true, recipient_id: params.recipient_id, result });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "session_expired") {
          return jsonResult({ error: "session_expired", action: "Call x_auth_setup to re-authenticate." });
        }
        return jsonResult({ error: "request_failed", message: err instanceof Error ? err.message : String(err) });
      }
    },
  };
}
