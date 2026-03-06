import { create } from 'zustand';
import { Agent } from '../types/agent';
import { fetchAgents } from '../services/AgentService';

interface AgentState {
  agents: Agent[];
  isLoading: boolean;
  error: string | null;
  agent: (id: string) => Agent | undefined;
  fetch: (host: string, port: number, authToken: string, useTLS?: boolean) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  isLoading: false,
  error: null,

  agent: (id) => get().agents.find(a => a.id === id),

  fetch: async (host, port, authToken, useTLS) => {
    if (!host) return;
    set({ isLoading: true, error: null });
    try {
      const agents = await fetchAgents({ host, port, authToken, useTLS });
      set({ agents, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch agents';
      set({ error: message, isLoading: false });
    }
  },
}));
