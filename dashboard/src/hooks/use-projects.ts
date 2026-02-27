"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  AgentWebSocket,
  type ConnectionState,
  type ServerMessage,
  type WsProject,
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

export function useProjects() {
  const [projects, setProjects] = useState<WsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  const wsRef = useRef<AgentWebSocket | null>(null);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case "auth_ok":
        wsRef.current?.send({ type: "project_list" });
        break;

      case "project_list":
        setProjects(msg.projects);
        setLoading(false);
        break;

      case "project_created":
        setProjects((prev) => {
          if (prev.some((p) => p.id === msg.project.id)) return prev;
          return [msg.project, ...prev];
        });
        break;

      case "project_updated":
        setProjects((prev) =>
          prev.map((p) => (p.id === msg.project.id ? msg.project : p)),
        );
        break;

      case "project_deleted":
        setProjects((prev) => prev.filter((p) => p.id !== msg.projectId));
        break;

      case "project_link_added":
        setProjects((prev) =>
          prev.map((p) =>
            p.id === msg.projectId
              ? { ...p, links: [...p.links, msg.link] }
              : p,
          ),
        );
        break;

      case "project_link_removed":
        setProjects((prev) =>
          prev.map((p) =>
            p.id === msg.projectId
              ? { ...p, links: p.links.filter((l) => l.id !== msg.linkId) }
              : p,
          ),
        );
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

  const deleteProject = useCallback((projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    wsRef.current?.send({ type: "project_delete", projectId });
  }, []);

  return {
    projects,
    loading,
    connectionState,
    isConnected: connectionState === "connected",
    deleteProject,
  };
}
