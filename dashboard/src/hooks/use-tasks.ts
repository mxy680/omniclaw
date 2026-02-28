"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  AgentWebSocket,
  type ConnectionState,
  type ServerMessage,
  type WsTask,
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

// ── Hook ───────────────────────────────────────────────────────────

export function useTasks() {
  const [tasks, setTasks] = useState<WsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  const wsRef = useRef<AgentWebSocket | null>(null);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "auth_ok":
        wsRef.current?.send({ type: "task_list" });
        break;

      case "task_list":
        setTasks(msg.tasks);
        setLoading(false);
        break;

      case "task_created":
        setTasks((prev) => {
          if (prev.some((t) => t.id === msg.task.id)) return prev;
          return [msg.task, ...prev];
        });
        break;

      case "task_updated":
        setTasks((prev) =>
          prev.map((t) => (t.id === msg.task.id ? msg.task : t)),
        );
        break;

      case "task_deleted":
        setTasks((prev) => prev.filter((t) => t.id !== msg.taskId));
        break;
    }
  }, []);

  useEffect(() => {
    const serverUrl = loadSetting(LS_URL_KEY, DEFAULT_URL);
    const authToken = loadSetting(LS_TOKEN_KEY, DEFAULT_TOKEN);

    const ws = new AgentWebSocket({
      onStateChange: (state) => setConnectionState(state),
      onMessage: handleMessage,
    });

    wsRef.current = ws;
    ws.connect(serverUrl, authToken);

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [handleMessage]);

  const executeTask = useCallback((taskId: string) => {
    wsRef.current?.send({ type: "task_execute", taskId });
  }, []);

  const approveTask = useCallback((taskId: string) => {
    wsRef.current?.send({ type: "task_approve", taskId });
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    wsRef.current?.send({ type: "task_delete", taskId });
  }, []);

  return {
    tasks,
    loading,
    connectionState,
    isConnected: connectionState === "connected",
    executeTask,
    approveTask,
    deleteTask,
  };
}
