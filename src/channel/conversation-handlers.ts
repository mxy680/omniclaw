import type { ConversationStore, ConversationRow, MessageRow } from "./conversation-store.js";
import type { WsServerInstance } from "./ws-server.js";
import type { WsClientMessage, WsConversation, WsMessage } from "./types.js";

// ── Helpers ─────────────────────────────────────────────────────────

function toWsConversation(row: ConversationRow): WsConversation {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toWsMessage(row: MessageRow): WsMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    text: row.text,
    isUser: row.is_user === 1,
    timestamp: row.timestamp,
    toolUses: row.tool_uses_json ? JSON.parse(row.tool_uses_json) : null,
    isStreaming: row.is_streaming === 1,
  };
}

// ── Handlers ────────────────────────────────────────────────────────

export function handleConversationMessage(
  connId: string,
  msg: WsClientMessage,
  store: ConversationStore,
  wsServer: WsServerInstance,
): void {
  switch (msg.type) {
    case "conversation_list": {
      const rows = store.listConversations();
      wsServer.send(connId, {
        type: "conversation_list",
        conversations: rows.map(toWsConversation),
      });
      break;
    }

    case "conversation_create": {
      const row = store.createConversation(msg.id, msg.title);
      const conversation = toWsConversation(row);
      wsServer.send(connId, { type: "conversation_created", conversation });
      wsServer.broadcastExcept(connId, { type: "conversation_created", conversation });
      break;
    }

    case "conversation_history": {
      const rows = store.getMessages(msg.conversationId, {
        before: msg.before,
        limit: msg.limit,
      });
      // getMessages returns DESC order; reverse to chronological
      const messages = rows.reverse().map(toWsMessage);
      wsServer.send(connId, {
        type: "conversation_history",
        conversationId: msg.conversationId,
        messages,
      });
      break;
    }

    case "conversation_delete": {
      store.deleteConversation(msg.conversationId);
      wsServer.send(connId, { type: "conversation_deleted", conversationId: msg.conversationId });
      wsServer.broadcastExcept(connId, {
        type: "conversation_deleted",
        conversationId: msg.conversationId,
      });
      break;
    }

    case "conversation_rename": {
      store.renameConversation(msg.conversationId, msg.title);
      wsServer.send(connId, {
        type: "conversation_renamed",
        conversationId: msg.conversationId,
        title: msg.title,
      });
      wsServer.broadcastExcept(connId, {
        type: "conversation_renamed",
        conversationId: msg.conversationId,
        title: msg.title,
      });
      break;
    }

    default:
      break;
  }
}
