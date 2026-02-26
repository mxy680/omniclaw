"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  AgentWebSocket,
  type ConnectionState,
  type ServerMessage,
} from "@/lib/websocket";
import { transformFitnessDay } from "@/lib/fitness-transform";
import type { FitnessDay } from "@/lib/fitness-data";

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

// ── Hook ────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useFitness(date: Date) {
  const [data, setData] = useState<FitnessDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  const wsRef = useRef<AgentWebSocket | null>(null);
  const dateStr = toDateStr(date);

  const requestDay = useCallback(
    (ws: AgentWebSocket, d: string) => {
      ws.send({ type: "fitness_day", date: d });
    },
    [],
  );

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "auth_ok":
          if (wsRef.current) requestDay(wsRef.current, dateStr);
          break;

        case "fitness_day":
          setData(transformFitnessDay(msg.data));
          setLoading(false);
          break;
      }
    },
    [dateStr, requestDay],
  );

  // Connect on mount
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

  // Re-request when date changes (and already connected)
  useEffect(() => {
    if (wsRef.current && connectionState === "connected") {
      setLoading(true);
      requestDay(wsRef.current, dateStr);
    }
  }, [dateStr, connectionState, requestDay]);

  return {
    data,
    loading,
    connectionState,
    isConnected: connectionState === "connected",
  };
}
