"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  AgentWebSocket,
  type ConnectionState,
  type ServerMessage,
  type WsConversation,
  type WsAttachment,
} from "@/lib/websocket";
import {
  appendOperation,
  completeOperation,
} from "@/lib/operation-store";

// ── Settings (localStorage) ────────────────────────────────────────

const LS_URL_KEY = "omniclaw-ws-url";
const LS_TOKEN_KEY = "omniclaw-ws-token";

const DEFAULT_URL = "ws://100.122.77.79:9800";
const DEFAULT_TOKEN =
  "12114508a208ff38b1ee25a2b043162ac6f966f5f96dc8db83de81be8b4d7ce2";

function loadSetting(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

// ── Types ──────────────────────────────────────────────────────────

export interface ToolUse {
  name: string;
  phase: "start" | "end";
  params?: Record<string, unknown>;
  result?: string;
  durationMs?: number;
  startedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolUses: ToolUse[];
  isStreaming: boolean;
  attachments?: WsAttachment[];
}

// ── Helpers ────────────────────────────────────────────────────────

function buildFileUrl(serverUrl: string, authToken: string, conversationId: string, fileId: string): string {
  try {
    const wsUrl = new URL(serverUrl);
    const protocol = wsUrl.protocol === "wss:" ? "https:" : "http:";
    const port = parseInt(wsUrl.port || "9600", 10) + 1;
    return `${protocol}//${wsUrl.hostname}:${port}/uploads/${conversationId}/${fileId}?token=${encodeURIComponent(authToken)}`;
  } catch {
    return "";
  }
}

// ── Hook ───────────────────────────────────────────────────────────

export function useConversations() {
  const [conversations, setConversations] = useState<WsConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [reasoningMap, setReasoningMap] = useState<Record<string, string>>({});
  const [partialReplyMap, setPartialReplyMap] = useState<Record<string, string>>({});
  const [activeToolsMap, setActiveToolsMap] = useState<Record<string, ToolUse[]>>({});
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [connectionError, setConnectionError] = useState<string>();
  const [serverUrl, setServerUrl] = useState(() =>
    loadSetting(LS_URL_KEY, DEFAULT_URL),
  );
  const [authToken, setAuthToken] = useState(() =>
    loadSetting(LS_TOKEN_KEY, DEFAULT_TOKEN),
  );

  const wsRef = useRef<AgentWebSocket | null>(null);
  const conversationsRef = useRef<WsConversation[]>([]);
  const serverUrlRef = useRef(serverUrl);
  const authTokenRef = useRef(authToken);

  useEffect(() => {
    serverUrlRef.current = serverUrl;
    authTokenRef.current = authToken;
  }, [serverUrl, authToken]);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "auth_ok":
        // Request conversation list after authenticating
        wsRef.current?.send({ type: "conversation_list" });
        break;

      case "auth_fail":
        break;

      case "conversation_list":
        conversationsRef.current = msg.conversations;
        setConversations(msg.conversations);
        break;

      case "conversation_created":
        setConversations((prev) => {
          if (prev.some((c) => c.id === msg.conversation.id)) return prev;
          const next = [msg.conversation, ...prev];
          conversationsRef.current = next;
          return next;
        });
        break;

      case "conversation_deleted":
        setConversations((prev) => prev.filter((c) => c.id !== msg.conversationId));
        setMessagesMap((prev) => {
          const next = { ...prev };
          delete next[msg.conversationId];
          return next;
        });
        setActiveConversationId((prev) =>
          prev === msg.conversationId ? null : prev,
        );
        break;

      case "conversation_renamed":
        setConversations((prev) => {
          const next = prev.map((c) =>
            c.id === msg.conversationId ? { ...c, title: msg.title } : c,
          );
          conversationsRef.current = next;
          return next;
        });
        break;

      case "conversation_updated":
        setConversations((prev) => {
          const filtered = prev.filter((c) => c.id !== msg.conversation.id);
          return [msg.conversation, ...filtered];
        });
        break;

      case "conversation_history": {
        const loaded: ChatMessage[] = msg.messages.map((m) => ({
          id: m.id,
          role: m.isUser ? "user" : "assistant",
          content: m.text,
          timestamp: new Date(m.timestamp),
          toolUses: (m.toolUses ?? []).map((t) => ({
            name: t.name,
            phase: t.phase as "start" | "end",
          })),
          isStreaming: m.isStreaming,
          attachments: m.attachments?.map((att) => ({
            ...att,
            url: buildFileUrl(serverUrlRef.current, authTokenRef.current, m.conversationId, att.fileId),
          })),
        }));
        setMessagesMap((prev) => ({
          ...prev,
          [msg.conversationId]: loaded,
        }));
        break;
      }

      case "message": {
        const convId = msg.conversationId;
        if (!convId) break;

        // User message broadcast from another client
        if (msg.isUser) {
          setMessagesMap((prev) => ({
            ...prev,
            [convId]: [
              ...(prev[convId] ?? []),
              {
                id: msg.id,
                role: "user",
                content: msg.text,
                timestamp: new Date(),
                toolUses: [],
                isStreaming: false,
                attachments: msg.attachments?.map((att) => ({
                  ...att,
                  url: buildFileUrl(serverUrlRef.current, authTokenRef.current, convId, att.fileId),
                })),
              },
            ],
          }));
          break;
        }

        // Agent message (streaming) — clear partial reply since the
        // finalized block text is now in the message itself.
        setPartialReplyMap((prev) => {
          if (!prev[convId]) return prev;
          const next = { ...prev }; delete next[convId]; return next;
        });
        setMessagesMap((prev) => {
          const existing = prev[convId] ?? [];
          const last = existing[existing.length - 1];
          if (last && last.role === "assistant" && last.isStreaming) {
            const updated = [...existing];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + msg.text,
            };
            return { ...prev, [convId]: updated };
          }
          return {
            ...prev,
            [convId]: [
              ...existing,
              {
                id: msg.id,
                role: "assistant",
                content: msg.text,
                timestamp: new Date(),
                toolUses: [],
                isStreaming: true,
              },
            ],
          };
        });
        break;
      }

      case "typing": {
        const convId = msg.conversationId;
        if (!convId) break;
        setTypingMap((prev) => ({ ...prev, [convId]: msg.active }));
        if (!msg.active) {
          // Mark last assistant message as done streaming
          setMessagesMap((prev) => {
            const existing = prev[convId] ?? [];
            const last = existing[existing.length - 1];
            if (last && last.role === "assistant" && last.isStreaming) {
              const updated = [...existing];
              updated[updated.length - 1] = { ...last, isStreaming: false };
              return { ...prev, [convId]: updated };
            }
            return prev;
          });
          // Transfer active tools to the last assistant message so they persist
          setActiveToolsMap((prev) => {
            const tools = prev[convId];
            if (tools && tools.length > 0) {
              setMessagesMap((mp) => {
                const existing = mp[convId] ?? [];
                const last = existing[existing.length - 1];
                if (last && last.role === "assistant") {
                  const updated = [...existing];
                  updated[updated.length - 1] = { ...last, toolUses: tools };
                  return { ...mp, [convId]: updated };
                }
                return mp;
              });
            }
            const next = { ...prev }; delete next[convId]; return next;
          });
          // Clear reasoning/partial reply state
          setReasoningMap((prev) => { const next = { ...prev }; delete next[convId]; return next; });
          setPartialReplyMap((prev) => { const next = { ...prev }; delete next[convId]; return next; });
        }
        break;
      }

      case "tool_use": {
        const convId = msg.conversationId;
        if (!convId) break;

        // Persist to operation store for the operations page
        const convTitle =
          conversationsRef.current.find((c) => c.id === convId)?.title ??
          "Unknown";
        if (msg.phase === "start") {
          appendOperation({
            id: `${Date.now()}-${msg.name}-${Math.random().toString(36).slice(2, 8)}`,
            toolName: msg.name,
            phase: "start",
            conversationId: convId,
            conversationTitle: convTitle,
            timestamp: new Date().toISOString(),
          });
        } else {
          completeOperation(msg.name, convId);
        }

        // Track active tools separately for the activity indicator
        setActiveToolsMap((prev) => {
          const current = prev[convId] ?? [];
          if (msg.phase === "start") {
            return { ...prev, [convId]: [...current, { name: msg.name, phase: "start", params: msg.params, startedAt: Date.now() }] };
          }
          return {
            ...prev,
            [convId]: current.map((t) =>
              t.name === msg.name && t.phase === "start"
                ? { ...t, phase: "end" as const, result: msg.result, durationMs: msg.durationMs }
                : t,
            ),
          };
        });

        setMessagesMap((prev) => {
          const existing = prev[convId] ?? [];
          const last = existing[existing.length - 1];
          if (!last || last.role !== "assistant") return prev;

          const updated = [...existing];
          const lastMsg = { ...last };

          if (msg.phase === "start") {
            lastMsg.toolUses = [
              ...lastMsg.toolUses,
              { name: msg.name, phase: "start", params: msg.params, startedAt: Date.now() },
            ];
          } else {
            lastMsg.toolUses = lastMsg.toolUses.map((t) =>
              t.name === msg.name && t.phase === "start"
                ? { ...t, phase: "end" as const, result: msg.result, durationMs: msg.durationMs }
                : t,
            );
          }

          updated[updated.length - 1] = lastMsg;
          return { ...prev, [convId]: updated };
        });
        break;
      }

      case "reasoning": {
        const convId = msg.conversationId;
        if (!convId) break;
        // Backend sends cumulative text, so replace (don't append)
        setReasoningMap((prev) => ({
          ...prev,
          [convId]: msg.text,
        }));
        break;
      }

      case "partial_reply": {
        const convId = msg.conversationId;
        if (!convId) break;
        // Backend sends cumulative text, so replace (don't append)
        setPartialReplyMap((prev) => ({
          ...prev,
          [convId]: msg.text,
        }));
        break;
      }

      case "assistant_message_start": {
        const convId = msg.conversationId;
        if (!convId) break;
        setReasoningMap((prev) => { const next = { ...prev }; delete next[convId]; return next; });
        setPartialReplyMap((prev) => { const next = { ...prev }; delete next[convId]; return next; });
        break;
      }

      case "error":
        // Show error in active conversation if any
        setActiveConversationId((activeId) => {
          if (activeId) {
            setMessagesMap((prev) => ({
              ...prev,
              [activeId]: [
                ...(prev[activeId] ?? []),
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `Error: ${msg.message}`,
                  timestamp: new Date(),
                  toolUses: [],
                  isStreaming: false,
                },
              ],
            }));
          }
          return activeId;
        });
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.disconnect();

    const ws = new AgentWebSocket({
      onStateChange: (state, error) => {
        setConnectionState(state);
        setConnectionError(error);
      },
      onMessage: handleMessage,
    });

    wsRef.current = ws;
    ws.connect(serverUrl, authToken);
  }, [serverUrl, authToken, handleMessage]);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = null;
  }, []);

  const selectConversation = useCallback((id: string | null) => {
    setActiveConversationId(id);
    if (id && wsRef.current) {
      // Load history for this conversation
      wsRef.current.send({
        type: "conversation_history",
        conversationId: id,
        limit: 100,
      });
    }
  }, []);

  const sendMessage = useCallback(
    (text: string, attachments?: WsAttachment[]) => {
      const trimmed = text.trim();
      if ((!trimmed && (!attachments || attachments.length === 0)) || !activeConversationId) return;

      const id = crypto.randomUUID();
      const userMsg: ChatMessage = {
        id,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
        toolUses: [],
        isStreaming: false,
        attachments,
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeConversationId]: [
          ...(prev[activeConversationId] ?? []),
          userMsg,
        ],
      }));
      wsRef.current?.send({
        type: "message",
        text: trimmed,
        id,
        conversationId: activeConversationId,
        attachments,
      });
    },
    [activeConversationId],
  );

  const createConversation = useCallback((title?: string) => {
    const id = crypto.randomUUID();
    wsRef.current?.send({ type: "conversation_create", id, title });
    // Optimistically add and select
    const now = Date.now();
    const conv: WsConversation = {
      id,
      title: title ?? "New Chat",
      createdAt: now,
      updatedAt: now,
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(id);
    setMessagesMap((prev) => ({ ...prev, [id]: [] }));
    return id;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    wsRef.current?.send({ type: "conversation_delete", conversationId: id });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMessagesMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveConversationId((prev) => (prev === id ? null : prev));
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    wsRef.current?.send({ type: "conversation_rename", conversationId: id, title });
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const updateSettings = useCallback(
    (url: string, token: string) => {
      setServerUrl(url);
      setAuthToken(token);
      localStorage.setItem(LS_URL_KEY, url);
      localStorage.setItem(LS_TOKEN_KEY, token);

      if (wsRef.current) {
        wsRef.current.disconnect();
        const ws = new AgentWebSocket({
          onStateChange: (state, error) => {
            setConnectionState(state);
            setConnectionError(error);
          },
          onMessage: handleMessage,
        });
        wsRef.current = ws;
        ws.connect(url, token);
      }
    },
    [handleMessage],
  );

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    conversations,
    activeConversationId,
    messages: messagesMap[activeConversationId ?? ""] ?? [],
    isTyping: typingMap[activeConversationId ?? ""] ?? false,
    reasoning: reasoningMap[activeConversationId ?? ""] ?? "",
    partialReply: partialReplyMap[activeConversationId ?? ""] ?? "",
    activeTools: activeToolsMap[activeConversationId ?? ""] ?? [],
    typingMap,
    connectionState,
    connectionError,
    serverUrl,
    authToken,
    isConnected: connectionState === "connected",
    connect,
    disconnect,
    selectConversation,
    sendMessage,
    createConversation,
    deleteConversation,
    renameConversation,
    updateSettings,
  };
}
