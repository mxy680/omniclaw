"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  AgentWebSocket,
  type ConnectionState,
  type ServerMessage,
  type WsJob,
  type WsJobRun,
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

export function useJobs() {
  const [jobs, setJobs] = useState<WsJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsCache, setRunsCache] = useState<Record<string, WsJobRun[]>>({});
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  const wsRef = useRef<AgentWebSocket | null>(null);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "auth_ok":
        wsRef.current?.send({ type: "job_list" });
        break;

      case "job_list":
        setJobs(msg.jobs);
        setLoading(false);
        break;

      case "job_created":
        setJobs((prev) => {
          if (prev.some((j) => j.id === msg.job.id)) return prev;
          return [msg.job, ...prev];
        });
        break;

      case "job_updated":
        setJobs((prev) =>
          prev.map((j) => (j.id === msg.job.id ? msg.job : j)),
        );
        break;

      case "job_deleted":
        setJobs((prev) => prev.filter((j) => j.id !== msg.jobId));
        setRunsCache((prev) => {
          const next = { ...prev };
          delete next[msg.jobId];
          return next;
        });
        break;

      case "job_runs":
        setRunsCache((prev) => ({ ...prev, [msg.jobId]: msg.runs }));
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

  const toggleJob = useCallback((jobId: string) => {
    if (!wsRef.current || connectionState !== "connected") return;
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, enabled: !j.enabled } : j)),
    );
    wsRef.current.send({ type: "job_toggle", jobId });
  }, [connectionState]);

  const loadRuns = useCallback((jobId: string) => {
    wsRef.current?.send({ type: "job_runs", jobId, limit: 10 });
  }, []);

  return {
    jobs,
    loading,
    connectionState,
    isConnected: connectionState === "connected",
    toggleJob,
    loadRuns,
    runsCache,
  };
}
