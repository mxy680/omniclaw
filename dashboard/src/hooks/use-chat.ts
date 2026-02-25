"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  AgentWebSocket,
  type ConnectionState,
  type ServerMessage,
} from "@/lib/websocket";

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
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolUses: ToolUse[];
  isStreaming: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
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

  // Keep latest messages in a ref so callbacks can access without stale closure
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "auth_ok":
      case "auth_fail":
        // Connection state handled via onStateChange
        break;

      case "message": {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "assistant" && last.isStreaming) {
            // Append to existing streaming message
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + msg.text,
            };
            return updated;
          }
          // New assistant message
          return [
            ...prev,
            {
              id: msg.id,
              role: "assistant",
              content: msg.text,
              timestamp: new Date(),
              toolUses: [],
              isStreaming: true,
            },
          ];
        });
        break;
      }

      case "typing":
        setIsTyping(msg.active);
        if (!msg.active) {
          // Mark last assistant message as done streaming
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.isStreaming) {
              const updated = [...prev];
              updated[updated.length - 1] = { ...last, isStreaming: false };
              return updated;
            }
            return prev;
          });
        }
        break;

      case "tool_use":
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.role !== "assistant") return prev;

          const updated = [...prev];
          const lastMsg = { ...last };

          if (msg.phase === "start") {
            lastMsg.toolUses = [
              ...lastMsg.toolUses,
              { name: msg.name, phase: "start" },
            ];
          } else {
            lastMsg.toolUses = lastMsg.toolUses.map((t) =>
              t.name === msg.name && t.phase === "start"
                ? { ...t, phase: "end" as const }
                : t,
            );
          }

          updated[updated.length - 1] = lastMsg;
          return updated;
        });
        break;

      case "error":
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${msg.message}`,
            timestamp: new Date(),
            toolUses: [],
            isStreaming: false,
          },
        ]);
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

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const id = crypto.randomUUID();
    const userMsg: ChatMessage = {
      id,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
      toolUses: [],
      isStreaming: false,
    };

    setMessages((prev) => [...prev, userMsg]);
    wsRef.current?.send({ type: "message", text: trimmed, id });
  }, []);

  const updateSettings = useCallback(
    (url: string, token: string) => {
      setServerUrl(url);
      setAuthToken(token);
      localStorage.setItem(LS_URL_KEY, url);
      localStorage.setItem(LS_TOKEN_KEY, token);

      // Reconnect if currently connected
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
    messages,
    isTyping,
    connectionState,
    connectionError,
    serverUrl,
    authToken,
    isConnected: connectionState === "connected",
    connect,
    disconnect,
    sendMessage,
    updateSettings,
  };
}
